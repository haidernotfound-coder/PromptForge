import JSZip from "jszip";

/**
 * Unified AI Chat — file packaging (Phase 4).
 *
 * This does NOT talk to any provider — it only turns text the model has
 * already produced (this turn's reply, or an earlier assistant reply in
 * the conversation) into real downloadable bytes: a single text/code file,
 * or a ZIP when there's more than one fenced code block worth packaging.
 * Reuses `jszip`, already a dependency for reading .zip attachments in
 * `attachment-extract.ts` — no new package, no new provider, no new
 * environment variable.
 *
 * The unified chat route decides *whether* to package something (see the
 * "file" intent in `chat-intent.ts`); this module only knows how.
 */

export interface GeneratedFile {
  name: string;
  mimeType: string;
  /** data:<mime>;base64,<...> — same shape the client already uses for
   *  attachment previews and the PPTForge download link, so the client
   *  needs no new decoding logic to turn this into a real download. */
  dataUrl: string;
  size: number;
}

interface CodeBlock {
  lang: string;
  code: string;
}

/** Pulls every fenced ```lang\n...\n``` block out of a markdown reply. */
export function extractCodeBlocks(markdown: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const re = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    const code = match[2].replace(/\n$/, "");
    if (code.trim().length === 0) continue;
    blocks.push({ lang: (match[1] || "").toLowerCase(), code });
  }
  return blocks;
}

const LANG_EXTENSIONS: Record<string, string> = {
  javascript: "js",
  js: "js",
  jsx: "jsx",
  typescript: "ts",
  ts: "ts",
  tsx: "tsx",
  python: "py",
  py: "py",
  java: "java",
  "c++": "cpp",
  cpp: "cpp",
  c: "c",
  "c#": "cs",
  csharp: "cs",
  cs: "cs",
  go: "go",
  golang: "go",
  rust: "rs",
  rs: "rs",
  ruby: "rb",
  rb: "rb",
  php: "php",
  swift: "swift",
  kotlin: "kt",
  kt: "kt",
  sql: "sql",
  bash: "sh",
  sh: "sh",
  shell: "sh",
  zsh: "sh",
  html: "html",
  css: "css",
  scss: "scss",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  xml: "xml",
  markdown: "md",
  md: "md",
  txt: "txt",
  text: "txt",
};

function extForLang(lang: string): string {
  return LANG_EXTENSIONS[lang] || "txt";
}

const MIME_BY_EXT: Record<string, string> = {
  zip: "application/zip",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  html: "text/html",
  css: "text/css",
};

function mimeForExt(ext: string): string {
  return MIME_BY_EXT[ext] || "text/plain";
}

function slugify(text: string, fallback: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  return slug || fallback;
}

function toDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

/** Packages the fenced code blocks in `sourceText` into a downloadable
 *  file: a single file with its detected extension when there's exactly
 *  one block, or a `.zip` of numbered/named files when there are several
 *  (or none, in which case the whole message is packaged as one .txt/.md
 *  so "give me that as a file" still produces something on a plain-prose
 *  reply). Never throws — packaging failures fall back to a plain .txt of
 *  the raw text so the user always gets *something* downloadable. */
export async function buildFileFromText(sourceText: string, topicHint: string): Promise<GeneratedFile> {
  const blocks = extractCodeBlocks(sourceText);
  const baseName = slugify(topicHint, "download");

  try {
    if (blocks.length === 1) {
      const ext = extForLang(blocks[0].lang);
      const buffer = Buffer.from(blocks[0].code, "utf-8");
      const name = `${baseName}.${ext}`;
      return { name, mimeType: mimeForExt(ext), dataUrl: toDataUrl(buffer, mimeForExt(ext)), size: buffer.length };
    }

    if (blocks.length > 1) {
      const zip = new JSZip();
      const usedNames = new Set<string>();
      blocks.forEach((block, idx) => {
        const ext = extForLang(block.lang);
        let name = `file-${idx + 1}.${ext}`;
        if (usedNames.has(name)) name = `file-${idx + 1}-${block.lang || "txt"}.${ext}`;
        usedNames.add(name);
        zip.file(name, block.code);
      });
      const buffer = await zip.generateAsync({ type: "nodebuffer" });
      const name = `${baseName}.zip`;
      return { name, mimeType: "application/zip", dataUrl: toDataUrl(buffer, "application/zip"), size: buffer.length };
    }

    // No fenced code — package the plain-text reply itself as a .md file so
    // "save that as a file" still works on a prose answer.
    const buffer = Buffer.from(sourceText, "utf-8");
    const name = `${baseName}.md`;
    return { name, mimeType: mimeForExt("md"), dataUrl: toDataUrl(buffer, mimeForExt("md")), size: buffer.length };
  } catch (err) {
    console.error("Unified AI Chat file packaging failed, falling back to plain text", err);
    const buffer = Buffer.from(sourceText, "utf-8");
    const name = `${baseName}.txt`;
    return { name, mimeType: mimeForExt("txt"), dataUrl: toDataUrl(buffer, mimeForExt("txt")), size: buffer.length };
  }
}

/** Wraps an already-built buffer (e.g. PPTForge's .pptx bytes) into the
 *  same `GeneratedFile` shape used everywhere else in the unified chat, so
 *  every delegate/packaging path hands the client one uniform file-card
 *  contract regardless of where the bytes came from. */
export function toGeneratedFile(buffer: Buffer, name: string, mimeType: string): GeneratedFile {
  return { name, mimeType, dataUrl: toDataUrl(buffer, mimeType), size: buffer.length };
}
