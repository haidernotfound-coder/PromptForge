/**
 * Server-side extraction for "document" attachments (PDF, DOCX). Browsers
 * have no reliable built-in way to pull text out of these, so the raw
 * bytes are sent up as base64 and turned into plain text here before being
 * folded into the chat prompt — same idea as the client-side text-file
 * reading in `lib/attachments.ts`, just done where the right libraries are
 * available.
 *
 * Deliberately best-effort: a failed/unsupported extraction returns a
 * short placeholder instead of throwing, so one bad upload never breaks
 * the rest of the chat request.
 */

const MAX_EXTRACTED_CHARS = 60_000;

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
  }

  if (!text.trim()) {
    return { name, text: `[Couldn't extract readable text from ${name}.]` };
  }
  return { name, text: truncate(text) };
}

/** Extracts a batch of documents in parallel, capped so a burst of large
 *  files can't stall a request indefinitely. */
export async function extractDocuments(docs: { name: string; base64: string }[]): Promise<ExtractedDocument[]> {
  const capped = docs.slice(0, 10);
  return Promise.all(capped.map((d) => extractDocumentText(d.name, d.base64)));
}
