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
  attachments?: { name: string; size: number; kind: string }[];
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
      ? attachments.map((a) => ({ name: a.name, size: a.size, kind: a.kind }))
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

/** Sends the full conversation to the unified chat endpoint and returns the
 *  assistant's reply text. Throws with a user-facing message on failure —
 *  same "surface the real error, don't fake a demo reply" behavior as
 *  StudyForge/CodeForge chat, since a thrown attachment/provider error is
 *  more useful to the user than a fabricated response. */
export async function sendChatMessage(
  history: ChatMessage[],
  attachments: ChatAttachment[] = []
): Promise<string> {
  const { contextBlocks, images, documents, errors } = buildAttachmentPayload(attachments);
  if (errors.length > 0) throw new Error(errors.join(" "));
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: history.map((m) => ({ role: m.role, content: m.content })),
      contextBlocks,
      images,
      documents,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && typeof data.output === "string" && data.output.trim()) {
    return data.output.trim();
  }
  throw new Error(typeof data.error === "string" ? data.error : `AI request failed (${res.status})`);
}
