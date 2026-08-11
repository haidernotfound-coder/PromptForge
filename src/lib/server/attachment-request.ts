/**
 * Shared shape + limits for the attachment payload every chat API route
 * (`/api/forge-ai`, `/api/codeforge`, `/api/studyforge`) accepts alongside
 * `messages`. Kept in one place so the 100 MB/file limit — and the file
 * count cap that goes with it — are enforced identically everywhere,
 * mirroring the client-side rules in `lib/attachments.ts`.
 */

export const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB, matches lib/attachments.ts
export const MAX_FILES = 10;

export interface AttachmentRequestBody {
  /** Pre-extracted text blocks (from text/code files, or documents already
   *  extracted client-side in a previous turn) to fold into the prompt. */
  contextBlocks?: string[];
  /** Data URLs (data:image/...;base64,...) for the vision model to read. */
  images?: string[];
  /** Raw PDF/DOCX bytes (base64, no data: prefix) to extract server-side. */
  documents?: { name: string; base64: string }[];
}

/** Rough byte size of a base64 string (without any data: URL prefix). */
function base64Bytes(b64: string): number {
  return Math.floor((b64.length * 3) / 4);
}

/** Validates an attachment payload against the shared limits. Returns an
 *  error message, or null if it's within bounds. This is the server-side
 *  half of the 100 MB/file enforcement — the client already checks this
 *  before upload, but a request could always come from elsewhere. */
export function validateAttachmentPayload(body: AttachmentRequestBody): string | null {
  const imageCount = body.images?.length ?? 0;
  const docCount = body.documents?.length ?? 0;
  if (imageCount + docCount > MAX_FILES) {
    return `Too many files attached — the limit is ${MAX_FILES} per message.`;
  }

  for (const url of body.images ?? []) {
    const commaIdx = url.indexOf(",");
    const b64 = commaIdx === -1 ? url : url.slice(commaIdx + 1);
    if (base64Bytes(b64) > MAX_FILE_BYTES) {
      return "One of the attached images is over the 100 MB per-file limit.";
    }
  }

  for (const doc of body.documents ?? []) {
    if (base64Bytes(doc.base64) > MAX_FILE_BYTES) {
      return `${doc.name} is over the 100 MB per-file limit.`;
    }
  }

  return null;
}
