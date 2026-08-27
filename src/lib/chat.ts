/**
 * Unified AI Chat — shared module
 * --------------------------------
 * Multi-conversation, ChatGPT-style chat: a sidebar of conversations
 * (new/rename/delete) instead of the single scratch-pad thread StudyForge
 * and CodeForge's chat panels use. Talks to `/api/chat`, which is Forge
 * AI's own Groq/Gemini provider wiring reused behind a general-purpose
 * system prompt (see that route for details) — no new provider/fallback
 * system, no new environment variables.
 *
 * Persistence is local to this browser for the same reason StudyForge/
 * CodeForge chat history is: it's chat scratch space, not synced
 * workspace data. Phase 2+ can layer real per-account persistence on top
 * without changing this module's shape.
 */

import { buildAttachmentPayload, type ChatAttachment } from "@/lib/attachments";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  attachments?: {
    name: string;
    size: number;
    kind: string;
    /** Persisted text content/extracted text/summary for this attachment,
     *  truncated — see the "Attachment memory" note below. Undefined for
     *  attachments we couldn't extract text from (e.g. a large file that
     *  went straight to the Gemini Files API) or for images. */
    contextText?: string;
  }[];
}

export interface ChatConversation {
  id: string;
  title: string;
  /** true until the user sends a first message or renames it — lets the UI
   *  auto-title from the first message without clobbering a manual rename. */
  autoTitled: boolean;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

function id(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const STORAGE_KEY = "nexprompt:chat:conversations";

function isValidMessage(m: unknown): m is ChatMessage {
  return (
    Boolean(m) &&
    typeof m === "object" &&
    ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
    typeof (m as ChatMessage).content === "string" &&
    typeof (m as ChatMessage).id === "string" &&
    typeof (m as ChatMessage).createdAt === "string"
  );
}

function isValidConversation(c: unknown): c is ChatConversation {
  return (
    Boolean(c) &&
    typeof c === "object" &&
    typeof (c as ChatConversation).id === "string" &&
    typeof (c as ChatConversation).title === "string" &&
    Array.isArray((c as ChatConversation).messages) &&
    (c as ChatConversation).messages.every(isValidMessage) &&
    typeof (c as ChatConversation).createdAt === "string" &&
    typeof (c as ChatConversation).updatedAt === "string"
  );
}

/** Loads all saved conversations, most-recently-updated first. Returns []
 *  on the server, on first load, or if storage is unavailable/corrupt. */
export function loadChatConversations(): ChatConversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isValidConversation)
      .map((c) => ({ ...c, autoTitled: c.autoTitled ?? false }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function saveChatConversations(conversations: ChatConversation[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // Storage unavailable (private browsing, quota) — history just won't persist.
  }
}

export function createChatConversation(): ChatConversation {
  const now = new Date().toISOString();
  return {
    id: id(),
    title: "New chat",
    autoTitled: true,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function makeChatMessage(
  role: ChatMessage["role"],
  content: string,
  attachments?: ChatAttachment[]
): ChatMessage {
  return {
    id: id(),
    role,
    content,
    createdAt: new Date().toISOString(),
    attachments: attachments?.length
      ? attachments.map((a) => ({
          name: a.name,
          size: a.size,
          kind: a.kind,
          contextText: a.textContent ?? a.extractedText ?? undefined,
        }))
      : undefined,
  };
}

/** Derives a short title from a first user message — same idea as most
 *  ChatGPT-style tools: first ~6 words, trimmed. */
export function titleFromMessage(content: string): string {
  const words = content.trim().split(/\s+/).slice(0, 6).join(" ");
  if (!words) return "New chat";
  return words.length < content.trim().length ? `${words}…` : words;
}

/** Cap on how much attachment memory gets replayed into a request: keeps a
 *  long conversation with several file uploads from ballooning every
 *  subsequent request's payload. Most-recent attachments win. */
const MAX_MEMORY_BLOCKS = 6;
const MAX_MEMORY_CHARS_PER_FILE = 6_000;
const MAX_MEMORY_TOTAL_CHARS = 20_000;

/** Builds "<file>" context blocks from every attachment with persisted
 *  `contextText` across the given messages (oldest first), most-recent
 *  files prioritized when the total is capped. This is the fix for the
 *  provider-switching memory problem: instead of relying on whichever
 *  provider handled a file to "remember" it, the extracted text/summary is
 *  replayed as plain context on every later turn, regardless of which
 *  provider (Gemini, Groq, or a delegated Forge) ends up answering. */
export function buildAttachmentMemoryBlocks(messages: ChatMessage[]): string[] {
  const withContext = messages
    .flatMap((m) => m.attachments ?? [])
    .filter((a): a is { name: string; size: number; kind: string; contextText: string } =>
      typeof a.contextText === "string" && a.contextText.trim().length > 0
    );

  // Most recent first, then de-duplicate by filename (a later re-upload of
  // the same name wins over an earlier one).
  const seen = new Set<string>();
  const deduped: typeof withContext = [];
  for (const a of [...withContext].reverse()) {
    if (seen.has(a.name)) continue;
    seen.add(a.name);
    deduped.push(a);
    if (deduped.length >= MAX_MEMORY_BLOCKS) break;
  }

  const blocks: string[] = [];
  let total = 0;
  for (const a of deduped) {
    const text = a.contextText.length > MAX_MEMORY_CHARS_PER_FILE
      ? `${a.contextText.slice(0, MAX_MEMORY_CHARS_PER_FILE)}\n[...truncated]`
      : a.contextText;
    if (total + text.length > MAX_MEMORY_TOTAL_CHARS) break;
    total += text.length;
    blocks.push(`<file name="${a.name}" from="earlier in this conversation">\n${text}\n</file>`);
  }
  return blocks;
}

/** Sends the full conversation to the unified chat endpoint and returns the
 *  assistant's reply text plus any newly extracted attachment text/summary
 *  the caller should persist onto the just-sent user message (see
 *  `buildAttachmentMemoryBlocks` above — this is how that text gets there
 *  in the first place). Throws with a user-facing message on failure —
 *  same "surface the real error, don't fake a demo reply" behavior as
 *  StudyForge/CodeForge chat, since a thrown attachment/provider error is
 *  more useful to the user than a fabricated response. */
export async function sendChatMessage(
  history: ChatMessage[],
  attachments: ChatAttachment[] = []
): Promise<{ output: string; attachmentContext: { name: string; text: string }[] }> {
  const { contextBlocks, images, documents, errors } = buildAttachmentPayload(attachments);
  if (errors.length > 0) throw new Error(errors.join(" "));

  // Everything except the message currently being sent — that one's own
  // attachments are already fully represented via images/documents/
  // contextBlocks above, so it's excluded here to avoid sending it twice.
  const memoryBlocks = buildAttachmentMemoryBlocks(history.slice(0, -1));

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: history.map((m) => ({ role: m.role, content: m.content })),
      contextBlocks: [...memoryBlocks, ...contextBlocks],
      images,
      documents,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && typeof data.output === "string" && data.output.trim()) {
    const attachmentContext = Array.isArray(data.attachmentContext)
      ? data.attachmentContext.filter(
          (d: unknown): d is { name: string; text: string } =>
            Boolean(d) && typeof (d as { name?: unknown }).name === "string" && typeof (d as { text?: unknown }).text === "string"
        )
      : [];
    return { output: data.output.trim(), attachmentContext };
  }
  throw new Error(typeof data.error === "string" ? data.error : `AI request failed (${res.status})`);
}
