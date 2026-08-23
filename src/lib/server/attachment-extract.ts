/**
 * Server-side extraction for "document" attachments (PDF, DOCX, ZIP) when
 * there's no Gemini key configured to read them directly. Browsers have no
 * reliable built-in way to pull text out of these, so the raw bytes are
 * sent up as base64 and turned into plain text here before being folded
 * into the chat prompt — same idea as the client-side text-file reading in
 * `lib/attachments.ts`, just done where the right libraries are available.
 *
 * This is the Groq-compatible fallback path: when Gemini is configured
 * (the normal case), the chat routes send PDFs/DOCX/ZIPs to Gemini
 * directly instead of calling this — Gemini reads the actual document
 * (tables, charts, layout, and for ZIPs, hands the archive's real code
 * content to the model) rather than a flattened text dump. This module
 * only runs when Gemini isn't configured, so attachments still work
 * (in reduced form) on a Groq-only install.
 *
 * Deliberately best-effort: a failed/unsupported extraction returns a
 * short placeholder instead of throwing, so one bad upload never breaks
 * the rest of the chat request.
 */

const MAX_EXTRACTED_CHARS = 60_000;
// Cap for how much of a ZIP's contents gets inlined as text — an archive
// can contain hundreds of files, so this keeps a big codebase upload from
// blowing out the prompt.
const MAX_ZIP_ENTRY_CHARS = 12_000;
const MAX_ZIP_ENTRIES = 40;

export interface ExtractedDocument {
  name: string;
  text: string;
}

function truncate(text: string): string {
  return text.length > MAX_EXTRACTED_CHARS ? `${text.slice(0, MAX_EXTRACTED_CHARS)}\n\n[...truncated]` : text;
}

async function extractPdf(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text?.trim() ?? "";
    } finally {
      await parser.destroy();
    }
  } catch (err) {
    console.error("PDF extraction failed", err);
    return "";
  }
}

async function extractDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value?.trim() ?? "";
  } catch (err) {
    console.error("DOCX extraction failed", err);
    return "";
  }
}

// Binary/asset extensions worth skipping when digesting a ZIP into text —
// they'd just come out as noise (or huge base64-looking garbage) in the
// prompt, and none of them are things a code review needs to "read".
const ZIP_SKIP_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp", ".svg",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".zip", ".gz", ".tar", ".7z", ".rar",
  ".pdf", ".mp3", ".mp4", ".mov", ".avi", ".webm",
  ".exe", ".dll", ".so", ".dylib", ".bin", ".class", ".jar", ".wasm",
  ".lock",
]);
const ZIP_SKIP_DIR_SEGMENTS = new Set(["node_modules", ".git", "dist", "build", ".next", "__pycache__", "venv", ".venv"]);

/** Unpacks a ZIP archive and produces a text digest: a file listing plus
 *  the contents of readable text/code files (skipping obvious binaries,
 *  build output, and dependency folders), so CodeForge's chat can actually
 *  review/fix code shipped as a .zip without needing Gemini configured. */
async function extractZip(buffer: Buffer): Promise<string> {
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);

    const entries = Object.values(zip.files).filter((f) => !f.dir);
    const listing = entries.map((f) => f.name).join("\n");

    const readable = entries.filter((f) => {
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
      if (ZIP_SKIP_EXTENSIONS.has(ext)) return false;
      const segments = f.name.split("/");
      if (segments.some((s) => ZIP_SKIP_DIR_SEGMENTS.has(s))) return false;
      return true;
    });

    const chunks: string[] = [`Archive contents (${entries.length} files):\n${listing}`];
    for (const entry of readable.slice(0, MAX_ZIP_ENTRIES)) {
      try {
        const content = await entry.async("string");
        const clipped = content.length > MAX_ZIP_ENTRY_CHARS
          ? `${content.slice(0, MAX_ZIP_ENTRY_CHARS)}\n[...truncated]`
          : content;
        chunks.push(`\n--- ${entry.name} ---\n${clipped}`);
      } catch {
        // Unreadable as text (likely binary despite the extension check) —
        // skip it rather than failing the whole extraction.
      }
    }
    if (readable.length > MAX_ZIP_ENTRIES) {
      chunks.push(`\n[...${readable.length - MAX_ZIP_ENTRIES} more file(s) not shown]`);
    }
    return chunks.join("\n");
  } catch (err) {
    console.error("ZIP extraction failed", err);
    return "";
  }
}

/** Extracts text from a single base64-encoded document. `name` is used
 *  only to pick the extraction method by extension and to label the
 *  result. */
export async function extractDocumentText(name: string, base64: string): Promise<ExtractedDocument> {
  const buffer = Buffer.from(base64, "base64");
  const ext = name.toLowerCase().slice(name.lastIndexOf("."));

  let text = "";
  if (ext === ".pdf") {
    text = await extractPdf(buffer);
  } else if (ext === ".docx") {
    text = await extractDocx(buffer);
  } else if (ext === ".zip") {
    text = await extractZip(buffer);
  }

  if (!text.trim()) {
    return { name, text: `[Couldn't extract readable text from ${name}.]` };
  }
  return { name, text: truncate(text) };
}

/** Extracts a batch of documents in parallel, capped so a burst of large
 *  files can't stall a request indefinitely. Skips any entry that only has
 *  a `geminiFileUri` (no `base64`) — those are handed to Gemini directly by
 *  the caller instead of being extracted locally. */
export async function extractDocuments(docs: { name: string; base64?: string; geminiFileUri?: string }[]): Promise<ExtractedDocument[]> {
  const capped = docs.filter((d) => d.base64).slice(0, 10);
  return Promise.all(capped.map((d) => extractDocumentText(d.name, d.base64!)));
}
