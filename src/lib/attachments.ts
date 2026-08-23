"use client";

/**
 * Shared chat attachments module
 * -------------------------------
 * Used by every NexPrompt AI chat (Forge AI, AI Coding Chat, AI Study
 * Chat, and any future one) so attaching files behaves identically
 * everywhere: same accepted types, same 100 MB/file limit, same chip
 * UI, same wire format to the server.
 *
 * Three kinds of attachment, by how the model gets to see them:
 *  - "image"  → sent as a data URL; the API route hands it to the Gemini
 *               attachment provider (or Groq's vision model as a fallback
 *               when Gemini isn't configured) to actually read it.
 *  - "text"   → plain text/code/CSV read client-side with FileReader and
 *               inlined into the message as a labeled block — never needs
 *               a model to "read" it since it's already text.
 *  - "document" → PDF/DOCX/ZIP. Small files are base64-encoded and sent
 *               inline with the chat request; the server hands them to
 *               Gemini, which reads the actual document (text, tables,
 *               charts, layout for PDFs; the real archive contents for
 *               ZIPs) rather than a flattened text dump. Large files
 *               (over `GEMINI_INLINE_THRESHOLD_BYTES`) are instead
 *               uploaded straight to the Gemini Files API via
 *               `/api/gemini-upload` as soon as they're attached, so the
 *               chat request itself only ever carries a small file
 *               reference, never the raw bytes. If Gemini isn't
 *               configured server-side, PDFs/DOCX/ZIPs still work through
 *               a reduced local-text-extraction fallback (see
 *               `lib/server/attachment-extract.ts`), but only up to the
 *               inline size — without Gemini there's no upload path for
 *               anything bigger.
 */

export const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB per file, enforced client + server
export const MAX_FILES = 10;

/** Per-file cap on how much extracted text gets inlined into the prompt,
 *  so one huge text file can't blow the model's context window. */
export const MAX_TEXT_CHARS = 60_000;

export type AttachmentKind = "image" | "text" | "document" | "unsupported";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
]);
const DOCUMENT_EXTENSIONS = new Set([".pdf", ".docx", ".zip"]);

const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".csv",
  ".tsv",
  ".json",
  ".yaml",
  ".yml",
  ".xml",
  ".html",
  ".css",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".java",
  ".c",
  ".h",
  ".cpp",
  ".cs",
  ".go",
  ".rs",
  ".rb",
  ".php",
  ".swift",
  ".kt",
  ".sql",
  ".sh",
  ".log",
]);

/** Passed to the file picker's `accept` attribute. */
export const ACCEPT_ATTR = [
  ...Array.from(IMAGE_EXTENSIONS),
  ...Array.from(DOCUMENT_EXTENSIONS),
  ...Array.from(TEXT_EXTENSIONS),
].join(",");

function extOf(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx).toLowerCase();
}

export function classifyFile(file: File): AttachmentKind {
  const ext = extOf(file.name);
  if (IMAGE_TYPES.has(file.type) || IMAGE_EXTENSIONS.has(ext)) return "image";
  if (DOCUMENT_TYPES.has(file.type) || DOCUMENT_EXTENSIONS.has(ext)) return "document";
  if (TEXT_EXTENSIONS.has(ext) || file.type.startsWith("text/")) return "text";
  return "unsupported";
}

export interface ChatAttachment {
  id: string;
  name: string;
  size: number;
  kind: AttachmentKind;
  /** Set for kind "image": a data: URL, used both for the on-screen
   *  thumbnail and as the payload sent to the vision model. */
  dataUrl?: string;
  /** Set for kind "text": the file's decoded text content (truncated to
   *  MAX_TEXT_CHARS). */
  textContent?: string;
  /** Set for kind "document" when small enough to inline: base64 of the
   *  raw file bytes, read server-side by Gemini (or extracted locally as a
   *  fallback when Gemini isn't configured). */
  base64?: string;
  /** MIME type, used server-side to tell Gemini what kind of file this
   *  is. Detected client-side from the File object at read time. */
  mimeType?: string;
  /** Set for kind "document" once a large file has been uploaded ahead of
   *  time to the Gemini Files API (see `/api/gemini-upload`) — sent to the
   *  chat route instead of `base64` so the raw bytes never touch that
   *  request's JSON body. */
  geminiFileUri?: string;
  truncated?: boolean;
  /** Populated once a "document" attachment comes back from the server
   *  with its text extracted, so it only has to happen once. */
  extractedText?: string;
  error?: string;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Validates a file against the shared rules before it's ever read.
 *  Returns an error message, or null if the file is acceptable. */
export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name} is ${formatFileSize(file.size)} — the limit is 100 MB per file.`;
  }
  if (file.size === 0) {
    return `${file.name} is empty.`;
  }
  if (classifyFile(file) === "unsupported") {
    return `${file.name} isn't a supported file type.`;
  }
  return null;
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// Groq currently limits base64-encoded image inputs to 4 MB. Keep the
// upload limit at 100 MB, but transparently resize/compress large images
// before they are sent through the chat API so normal phone/screenshot
// uploads can actually reach the vision model. This also comfortably fits
// under Gemini's inline-image limits, so the same compressed image works
// for both providers.
const MAX_GROQ_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_GROQ_IMAGE_DIMENSION = 2048;
// Documents (PDF/DOCX/ZIP) at or under this size are base64-encoded and
// sent inline with the chat request, same as before. Anything larger is
// uploaded ahead of time to the Gemini Files API via `readAttachment`
// below, so the chat request's own JSON payload — which still has to fit
// through a serverless function body — never has to carry a huge base64
// blob. This is the "prefer the Files API for larger attachments instead
// of converting huge files to base64" behavior.
const GEMINI_INLINE_THRESHOLD_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_TRANSPORT_BYTES = 6 * 1024 * 1024;

async function readImageForGroq(file: File): Promise<string> {
  const original = await readAsDataUrl(file);
  if (file.size <= MAX_GROQ_IMAGE_BYTES) return original;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX_GROQ_IMAGE_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas is unavailable");
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.82;
        let output = canvas.toDataURL("image/webp", quality);
        while (output.length > MAX_GROQ_IMAGE_BYTES * 1.37 && quality > 0.45) {
          quality -= 0.08;
          output = canvas.toDataURL("image/webp", quality);
        }
        resolve(output);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Failed to process image"));
      }
    };
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = original;
  });
}

function extToMimeType(name: string): string {
  const ext = extOf(name);
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".zip":
      return "application/zip";
    default:
      return "application/octet-stream";
  }
}

/** Uploads a large document/archive straight to the Gemini Files API via
 *  the server's `/api/gemini-upload` route, sending the raw file bytes as
 *  the request body (never base64-encoded, never wrapped in JSON) so
 *  nothing about a 50 MB ZIP ever has to fit through the chat endpoint's
 *  JSON payload. Returns the file reference to attach to the chat request,
 *  or throws with a message suitable to show the user. */
async function uploadDocumentToGemini(file: File): Promise<{ fileUri: string; mimeType: string }> {
  const mimeType = file.type || extToMimeType(file.name);
  const res = await fetch("/api/gemini-upload", {
    method: "POST",
    headers: {
      "content-type": mimeType,
      "x-attachment-name": encodeURIComponent(file.name),
      "x-attachment-type": mimeType,
    },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.fileUri !== "string") {
    throw new Error(typeof data.error === "string" ? data.error : `Couldn't upload ${file.name} to the AI provider.`);
  }
  return { fileUri: data.fileUri, mimeType: typeof data.mimeType === "string" ? data.mimeType : mimeType };
}

/** Reads a single File into a ChatAttachment, handling each kind
 *  appropriately. Never throws — read failures are captured on `.error`
 *  so one bad file doesn't block the rest of the batch. */
export async function readAttachment(file: File): Promise<ChatAttachment> {
  const kind = classifyFile(file);
  const base: ChatAttachment = { id: makeId(), name: file.name, size: file.size, kind };

  try {
    if (kind === "image") {
      base.dataUrl = await readImageForGroq(file);
    } else if (kind === "text") {
      const full = await readAsText(file);
      base.truncated = full.length > MAX_TEXT_CHARS;
      base.textContent = base.truncated ? full.slice(0, MAX_TEXT_CHARS) : full;
    } else if (kind === "document") {
      base.mimeType = file.type || extToMimeType(file.name);
      if (file.size > GEMINI_INLINE_THRESHOLD_BYTES) {
        try {
          const { fileUri, mimeType } = await uploadDocumentToGemini(file);
          base.geminiFileUri = fileUri;
          base.mimeType = mimeType;
        } catch (err) {
          base.error = err instanceof Error
            ? err.message
            : `${file.name} is too large to send inline and couldn't be uploaded.`;
        }
      } else {
        const dataUrl = await readAsDataUrl(file);
        base.base64 = dataUrl.split(",")[1] ?? "";
      }
    }
  } catch {
    base.error = `Couldn't read ${file.name}.`;
  }

  return base;
}

/** Builds the wire payload sent to a chat API route: text content gets
 *  folded into a single context string the system prompt can quote,
 *  images are passed through as data URLs, and documents (PDF/DOCX/ZIP)
 *  are passed through either as inline base64 or a Gemini file reference,
 *  for the server to hand to the Gemini attachment provider. */
export function buildAttachmentPayload(attachments: ChatAttachment[]): {
  contextBlocks: string[];
  images: string[];
  documents: { name: string; mimeType?: string; base64?: string; geminiFileUri?: string }[];
  errors: string[];
} {
  const contextBlocks: string[] = [];
  const images: string[] = [];
  const documents: { name: string; mimeType?: string; base64?: string; geminiFileUri?: string }[] = [];
  const errors: string[] = [];

  for (const att of attachments) {
    if (att.error) {
      errors.push(att.error);
      continue;
    }
    if (att.kind === "image" && att.dataUrl) {
      images.push(att.dataUrl);
    } else if (att.kind === "text" && att.textContent !== undefined) {
      contextBlocks.push(
        `<file name="${att.name}"${att.truncated ? " truncated=\"true\"" : ""}>\n${att.textContent}\n</file>`
      );
    } else if (att.kind === "document") {
      if (att.extractedText) {
        contextBlocks.push(`<file name="${att.name}">\n${att.extractedText}\n</file>`);
      } else if (att.geminiFileUri) {
        documents.push({ name: att.name, mimeType: att.mimeType, geminiFileUri: att.geminiFileUri });
      } else if (att.base64) {
        documents.push({ name: att.name, mimeType: att.mimeType, base64: att.base64 });
      }
    }
  }

  // Files uploaded ahead of time (geminiFileUri set) contribute ~0 bytes to
  // this request's own JSON payload — only inline base64 counts toward the
  // transport cap below.
  const encodedBytes = images.reduce((sum, url) => sum + Math.max(0, Math.floor(((url.split(",")[1] ?? "").length * 3) / 4)), 0)
    + documents.reduce((sum, doc) => sum + Math.max(0, Math.floor(((doc.base64 ?? "").length * 3) / 4)), 0);
  if (encodedBytes > MAX_TOTAL_ATTACHMENT_TRANSPORT_BYTES) {
    errors.push("The selected attachments are too large to send in one AI message. Try fewer or smaller files.");
  }

  return { contextBlocks, images, documents, errors };
}
