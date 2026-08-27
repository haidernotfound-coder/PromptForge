import { GoogleGenAI, ApiError, type Content, type Part } from "@google/genai";

/**
 * Gemini attachment/multimodal provider — shared by every NexPrompt chat
 * (Forge AI, AI Coding Chat, AI Study Chat).
 *
 * Normal, attachment-free chat turns keep going through each product's own
 * Groq pool exactly as before (see the three `src/app/api/*\/route.ts`
 * files). The moment a chat turn carries an image or document, that one
 * request is routed here instead — Gemini can natively read images, PDFs
 * (text, tables, charts, layout), DOCX/TXT/CSV/code text, and ZIP archives
 * (as their extracted contents), which is a strictly larger set than what
 * Groq's text model + one vision model can do, and it can actually look at
 * the file rather than a text-only extraction of it.
 *
 * Same operating shape as every Groq pool in this app: multiple keys
 * (`GEMINI_API_KEY_1`..`_7`, see `lib/supabase/config.ts`), start from
 * whichever key last worked, and instantly retry the next key on a
 * transient/quota failure. A permanent failure (bad request, unsupported
 * file, safety block) stops immediately instead of burning through all 7
 * keys on a request that will fail identically on every one of them.
 */

export const GEMINI_TEXT_MODEL = "gemini-3.6-flash";
// Files above this size go through the Gemini Files API (upload once, then
// reference by URI) instead of being inlined as base64 in the same request
// that also carries the model prompt — keeps the generateContent request
// itself small regardless of how big the attachment is.
export const GEMINI_INLINE_BYTES_THRESHOLD = 15 * 1024 * 1024; // 15 MB
// Hard ceiling for anything sent to Gemini at all, inline or via Files API.
// The client-facing limit stays 100 MB (see lib/attachments.ts); this is the
// provider-specific ceiling referenced by that 100 MB path.
export const GEMINI_MAX_FILE_BYTES = 100 * 1024 * 1024;

export interface GeminiSearchSource {
  title: string;
  uri: string;
}

export type GeminiCallResult =
  | { ok: true; output: string; sources?: GeminiSearchSource[] }
  | { ok: false; exhausted: true; detail?: string } // quota/rate-limit/transient — try the next key
  | { ok: false; exhausted: false; status: number; detail?: string }; // permanent — stop retrying

export interface GeminiAttachmentImage {
  /** data:image/...;base64,... */
  dataUrl: string;
}

export interface GeminiAttachmentDocument {
  name: string;
  mimeType?: string;
  /** Raw bytes, base64-encoded, no data: prefix — used when the file is
   *  small enough to inline directly in the request. */
  base64?: string;
  /** Set once the file has been uploaded to the Gemini Files API — used
   *  instead of `base64` for large attachments so the file's bytes never
   *  have to round-trip through the chat JSON payload at all. */
  geminiFileUri?: string;
}

export interface GeminiChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** True for errors that are worth retrying with the next key: rate limits,
 *  quota exhaustion, auth problems with *this* key, or a transient
 *  provider-side failure. False (permanent) for things like an unsupported
 *  file/mime type or a malformed request — retrying those with a different
 *  key would fail identically every time. */
function isRetryableGeminiError(err: unknown): { retryable: boolean; status?: number; detail?: string } {
  if (err instanceof ApiError) {
    const status = err.status;
    // 429 = rate limited/quota, 401/403 = bad/expired key, 500/502/503/504 =
    // provider-side transient failure. Everything else (400 bad request,
    // 404, 415/422 unsupported file, etc.) is permanent for this request.
    const retryable = status === 429 || status === 401 || status === 403 || status >= 500;
    return { retryable, status, detail: err.message?.slice(0, 500) };
  }
  if (err instanceof Error) {
    // Network-level failures (fetch throwing, DNS, timeout) — worth trying
    // the next key/connection.
    const msg = err.message.toLowerCase();
    if (msg.includes("fetch failed") || msg.includes("network") || msg.includes("timeout") || msg.includes("econnreset")) {
      return { retryable: true, detail: err.message.slice(0, 500) };
    }
    return { retryable: false, detail: err.message.slice(0, 500) };
  }
  return { retryable: false, detail: "Unknown error" };
}

/** Uploads one file to the Gemini Files API and waits for it to leave the
 *  PROCESSING state, so the caller can safely reference it by URI right
 *  away. Used for attachments over `GEMINI_INLINE_BYTES_THRESHOLD` (and
 *  always for anything coming through the dedicated upload route, since
 *  that route exists specifically to avoid ever inlining a big file into
 *  the chat JSON payload). Throws on failure — the caller decides whether
 *  that's retryable with another key. */
export async function uploadFileToGemini(
  apiKey: string,
  buffer: Buffer,
  mimeType: string,
  displayName: string
): Promise<{ fileUri: string; mimeType: string }> {
  const ai = new GoogleGenAI({ apiKey });
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType || "application/octet-stream" });

  let file = await ai.files.upload({
    file: blob,
    config: { mimeType: mimeType || "application/octet-stream", displayName: displayName.slice(0, 512) },
  });

  // Newly uploaded files start in PROCESSING for larger media; poll briefly
  // until ACTIVE (or FAILED) rather than handing back a URI the model can't
  // read yet. Most documents/images finish well under this window.
  const deadline = Date.now() + 60_000;
  while (file.state === "PROCESSING" && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    if (!file.name) break;
    file = await ai.files.get({ name: file.name });
  }

  if (file.state === "FAILED") {
    throw new Error(`Gemini failed to process the uploaded file "${displayName}"`);
  }
  if (!file.uri || !file.mimeType) {
    throw new Error(`Gemini did not return a usable file reference for "${displayName}"`);
  }
  return { fileUri: file.uri, mimeType: file.mimeType };
}

function partsForDocument(doc: GeminiAttachmentDocument): Part[] {
  const mimeType = doc.mimeType || guessMimeType(doc.name);
  const parts: Part[] = [{ text: `Attached file: ${doc.name}` }];
  if (doc.geminiFileUri) {
    parts.push({ fileData: { fileUri: doc.geminiFileUri, mimeType } });
  } else if (doc.base64) {
    parts.push({ inlineData: { data: doc.base64, mimeType } });
  }
  return parts;
}

export function guessMimeType(name: string): string {
  const ext = name.toLowerCase().slice(name.lastIndexOf("."));
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".zip":
      return "application/zip";
    case ".csv":
      return "text/csv";
    case ".txt":
    case ".md":
    case ".log":
      return "text/plain";
    case ".json":
      return "application/json";
    default:
      return "text/plain";
  }
}

/** Builds the Gemini `contents` array from chat history plus the current
 *  turn's attachments — folded onto the last user turn, same convention
 *  every Groq route in this app already uses for images/context text. */
function buildContents(
  history: GeminiChatTurn[],
  images: GeminiAttachmentImage[],
  documents: GeminiAttachmentDocument[],
  extraContextText: string
): Content[] {
  return history.map((turn, idx): Content => {
    const role = turn.role === "assistant" ? "model" : "user";
    const isLastUser = idx === history.length - 1 && turn.role === "user";
    const hasAttachments = images.length > 0 || documents.length > 0;

    if (!isLastUser || (!extraContextText && !hasAttachments)) {
      return { role, parts: [{ text: turn.content }] };
    }

    const parts: Part[] = [];
    const textBody = extraContextText ? `${turn.content}\n\n${extraContextText}` : turn.content;
    parts.push({ text: textBody || "(see attached file(s))" });

    for (const img of images) {
      const commaIdx = img.dataUrl.indexOf(",");
      const meta = img.dataUrl.slice(5, commaIdx); // "image/png;base64"
      const mimeType = meta.split(";")[0] || "image/png";
      const data = img.dataUrl.slice(commaIdx + 1);
      parts.push({ inlineData: { data, mimeType } });
    }

    for (const doc of documents) {
      parts.push(...partsForDocument(doc));
    }

    return { role, parts };
  });
}

/** Runs one Gemini chat turn against the given contents/system prompt with
 *  a single API key. Never throws — failures are captured on the return
 *  value so the caller can decide whether to retry with the next key. */
async function callGeminiOnce(
  apiKey: string,
  systemInstruction: string,
  contents: Content[],
  opts: { enableWebSearch?: boolean } = {}
): Promise<GeminiCallResult> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const config: Record<string, unknown> = {
      systemInstruction,
      maxOutputTokens: 4096,
      temperature: 0.4,
    };
    // Gemini's built-in Google Search grounding tool — reuses the same
    // Gemini API key pool every attachment turn already authenticates
    // with, so web search needs no new provider, env var, or fallback
    // system of its own (see Phase 4 note in chat/route.ts). Passed as a
    // loosely-typed field since the installed @google/genai SDK version's
    // exact `tools` typing isn't pinned down here; the Gemini API itself
    // accepts this shape.
    if (opts.enableWebSearch) {
      config.tools = [{ googleSearch: {} }];
    }
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: config as any,
    });

    const output = (response.text ?? "").trim();
    if (!output) {
      return { ok: false, exhausted: false, status: 502, detail: "Empty response from Gemini" };
    }

    const sources = extractSearchSources(response);
    return { ok: true, output, ...(sources.length ? { sources } : {}) };
  } catch (err) {
    console.error("Gemini API error", err);
    const { retryable, status, detail } = isRetryableGeminiError(err);
    if (retryable) {
      return { ok: false, exhausted: true, detail };
    }
    return { ok: false, exhausted: false, status: status ?? 502, detail };
  }
}

export interface GeminiChatRequest {
  keys: string[];
  systemInstruction: string;
  history: GeminiChatTurn[];
  images?: GeminiAttachmentImage[];
  documents?: GeminiAttachmentDocument[];
  /** Any already-extracted plain-text context (from text/code file
   *  attachments, which never need to go through Gemini itself since
   *  they're already text) to fold in alongside the file attachments. */
  extraContextText?: string;
  /** Phase 4 (Files + Web Search): grounds the reply in live Google Search
   *  results via Gemini's own built-in search tool instead of a separate
   *  search API/key. Mutually usable alongside attachments, though in
   *  practice the unified chat route only sets this for attachment-free
   *  "search the web for…" turns. */
  enableWebSearch?: boolean;
}

/** Pulls (title, uri) pairs out of Gemini's `groundingMetadata` so the
 *  caller can show "Sources" under a web-search-grounded reply. Best-effort
 *  — grounding metadata shape is additive/optional, so this never throws. */
function extractSearchSources(response: { candidates?: unknown[] }): GeminiSearchSource[] {
  try {
    const candidate = response.candidates?.[0] as
      | { groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] } }
      | undefined;
    const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];
    const seen = new Set<string>();
    const sources: GeminiSearchSource[] = [];
    for (const chunk of chunks) {
      const uri = chunk.web?.uri;
      const title = chunk.web?.title;
      if (!uri || seen.has(uri)) continue;
      seen.add(uri);
      sources.push({ title: title || uri, uri });
    }
    return sources;
  } catch {
    return [];
  }
}

export interface GeminiChatOutcome {
  result: GeminiCallResult;
  /** Index (into `request.keys`) of the key that succeeded, so the caller
   *  can remember it as the starting point for next time. */
  goodKeyIndex?: number;
  /** Every per-key failure detail, in the order attempted — surfaced in the
   *  final error message so a total failure is debuggable from the client. */
  attempts: { keyIndex: number; detail?: string }[];
}

export interface GeminiUploadOutcome {
  ok: true;
  fileUri: string;
  mimeType: string;
  goodKeyIndex: number;
}
export type GeminiUploadResult =
  | GeminiUploadOutcome
  | { ok: false; exhausted: true; detail?: string }
  | { ok: false; exhausted: false; detail?: string };

/** Uploads one file to the Gemini Files API, rotating through the key pool
 *  on transient/quota failures — same contract as `runGeminiChat`. Used by
 *  `/api/gemini-upload` so large attachments (over the inline threshold)
 *  are sent to Gemini once, ahead of the chat request, instead of being
 *  base64-embedded in it. */
export async function uploadFileToGeminiWithRotation(
  keys: string[],
  buffer: Buffer,
  mimeType: string,
  displayName: string,
  startIndex: number
): Promise<GeminiUploadResult> {
  const order = keys.map((_, i) => (startIndex + i) % keys.length);
  let lastDetail: string | undefined;
  let lastExhausted = true;

  for (const i of order) {
    try {
      const { fileUri, mimeType: resolvedMimeType } = await uploadFileToGemini(keys[i], buffer, mimeType, displayName);
      return { ok: true, fileUri, mimeType: resolvedMimeType, goodKeyIndex: i };
    } catch (err) {
      console.error("Gemini file upload error", err);
      const { retryable, detail } = isRetryableGeminiError(err);
      lastDetail = detail;
      lastExhausted = retryable;
      if (!retryable) break;
    }
  }
  return { ok: false, exhausted: lastExhausted, detail: lastDetail };
}

/** Runs a Gemini chat request across the configured key pool, starting
 *  from `startIndex` and wrapping around, retrying only on transient/quota
 *  failures — the same rotation contract as `callGroq` in every product
 *  route. Stops immediately on a permanent failure (bad request/unsupported
 *  file) instead of repeating it against every remaining key. */
export async function runGeminiChat(request: GeminiChatRequest, startIndex: number): Promise<GeminiChatOutcome> {
  const { keys, systemInstruction, history, images = [], documents = [], extraContextText = "", enableWebSearch = false } = request;
  const contents = buildContents(history, images, documents, extraContextText);
  const order = keys.map((_, i) => (startIndex + i) % keys.length);
  const attempts: { keyIndex: number; detail?: string }[] = [];

  let lastResult: GeminiCallResult | null = null;
  for (const i of order) {
    const result = await callGeminiOnce(keys[i], systemInstruction, contents, { enableWebSearch });
    lastResult = result;
    if (result.ok) {
      return { result, goodKeyIndex: i, attempts };
    }
    attempts.push({ keyIndex: i, detail: result.exhausted ? result.detail : result.detail });
    if (!result.exhausted) {
      // Permanent failure — every remaining key would fail the same way.
      break;
    }
  }

  return { result: lastResult ?? { ok: false, exhausted: true, detail: "No Gemini keys configured" }, attempts };
}
