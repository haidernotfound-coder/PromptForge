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
 * Cross-device sync (Phase 17)
 * -----------------------------
 * Chat history used to be local to whichever browser created it — two
 * devices signed into the same account saw two unrelated histories,
 * because `loadChatConversations`/`saveChatConversations` only ever
 * touched `window.localStorage`.
 *
 * The fix keeps localStorage as a *cache* (so the sidebar still renders
 * instantly, offline, or in demo mode) but makes `chat_conversations` /
 * `chat_messages` in Supabase (see supabase/migrations/phase17_chat_sync.sql)
 * the source of truth whenever the visitor is signed into a real account:
 * `initChatCloudSync` pulls the server's copy down on mount, reconciles it
 * against whatever's cached locally by `updatedAt` (never letting a stale
 * local copy overwrite a newer server one, and vice versa), then every
 * subsequent local change is debounced and pushed per-conversation via
 * `/api/chat-history` (see chat-cloud-sync.ts) so a rename on one device
 * and a new message on another converge without either clobbering the
 * other. Demo mode (Supabase not configured) or a demo-only session falls
 * back to the previous local-only behavior untouched.
 */

import { buildAttachmentPayload, type ChatAttachment } from "@/lib/attachments";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  pullChatConversations,
  pushChatConversation,
  deleteChatConversationRemote,
} from "@/lib/chat-cloud-sync";

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
  /** Phase 4 (Files + Web Search): real generated files attached to an
   *  assistant reply — a PPTForge deck, a packaged code ZIP, or a plain
   *  text/markdown file — rendered as a file card instead of an inline
   *  markdown data: link. */
  files?: {
    name: string;
    mimeType: string;
    dataUrl: string;
    size: number;
  }[];
  /** Phase 4: web sources Gemini's search grounding cited for this reply,
   *  shown as a short "Sources" list under the message. */
  sources?: { title: string; uri: string }[];
}

export interface ChatConversation {
  id: string;
  title: string;
  /** true until the user sends a first message or renames it — lets the UI
   *  auto-title from the first message without clobbering a manual rename. */
  autoTitled: boolean;
  /** "voice" conversations are Gemini Live calls (see use-voice-session.ts
   *  / voice-panel.tsx) whose transcript turns get persisted here just
   *  like a text chat's messages — same storage, same sidebar, just shown
   *  with an audio icon and reopened into Voice Mode instead of the text
   *  panel. Defaults to "text" for conversations saved before this existed. */
  kind?: "text" | "voice";
  /** Pinned conversations are pulled to their own section at the top of
   *  the sidebar, above the date groups. Synced like any other field so it
   *  follows the account across devices. Defaults to false for
   *  conversations saved before this existed. */
  pinned?: boolean;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

function id(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const STORAGE_KEY = "nexprompt:chat:conversations";

function isValidMessage(m: unknown): m is ChatMessage {
  return (
    Boolean(m) &&
    typeof m === "object" &&
    ((m as ChatMessage).role === "user" ||
      (m as ChatMessage).role === "assistant") &&
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
      .map((c) => ({
        ...c,
        autoTitled: c.autoTitled ?? false,
        kind: c.kind ?? "text",
        pinned: c.pinned ?? false,
      }))
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
    kind: "text",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createVoiceConversation(): ChatConversation {
  const now = new Date().toISOString();
  return {
    id: id(),
    title: "New voice chat",
    autoTitled: true,
    kind: "voice",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function makeChatMessage(
  role: ChatMessage["role"],
  content: string,
  attachments?: ChatAttachment[],
  extras?: { files?: ChatMessage["files"]; sources?: ChatMessage["sources"] },
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
    files: extras?.files?.length ? extras.files : undefined,
    sources: extras?.sources?.length ? extras.sources : undefined,
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
    .filter(
      (
        a,
      ): a is {
        name: string;
        size: number;
        kind: string;
        contextText: string;
      } => typeof a.contextText === "string" && a.contextText.trim().length > 0,
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
    const text =
      a.contextText.length > MAX_MEMORY_CHARS_PER_FILE
        ? `${a.contextText.slice(0, MAX_MEMORY_CHARS_PER_FILE)}\n[...truncated]`
        : a.contextText;
    if (total + text.length > MAX_MEMORY_TOTAL_CHARS) break;
    total += text.length;
    blocks.push(
      `<file name="${a.name}" from="earlier in this conversation">\n${text}\n</file>`,
    );
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
  attachments: ChatAttachment[] = [],
): Promise<{
  output: string;
  attachmentContext: { name: string; text: string }[];
  files: ChatMessage["files"];
  sources: ChatMessage["sources"];
}> {
  const { contextBlocks, images, documents, errors } =
    buildAttachmentPayload(attachments);
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
            Boolean(d) &&
            typeof (d as { name?: unknown }).name === "string" &&
            typeof (d as { text?: unknown }).text === "string",
        )
      : [];
    const files: ChatMessage["files"] = Array.isArray(data.files)
      ? data.files.filter(
          (f: unknown): f is NonNullable<ChatMessage["files"]>[number] =>
            Boolean(f) &&
            typeof (f as { name?: unknown }).name === "string" &&
            typeof (f as { mimeType?: unknown }).mimeType === "string" &&
            typeof (f as { dataUrl?: unknown }).dataUrl === "string" &&
            typeof (f as { size?: unknown }).size === "number",
        )
      : undefined;
    const sources: ChatMessage["sources"] = Array.isArray(data.sources)
      ? data.sources.filter(
          (s: unknown): s is NonNullable<ChatMessage["sources"]>[number] =>
            Boolean(s) &&
            typeof (s as { title?: unknown }).title === "string" &&
            typeof (s as { uri?: unknown }).uri === "string",
        )
      : undefined;
    return { output: data.output.trim(), attachmentContext, files, sources };
  }
  throw new Error(
    typeof data.error === "string"
      ? data.error
      : `AI request failed (${res.status})`,
  );
}

// ---------------------------------------------------------------------------
// Cloud sync (Phase 17)
// ---------------------------------------------------------------------------

/** Merges the server's conversations with whatever's cached locally,
 *  conversation-by-conversation, keeping whichever side has the newer
 *  `updatedAt` — never blindly preferring one source, so a stale local
 *  cache can't clobber a newer server write (a message sent from another
 *  device) and a server copy that hasn't caught up yet can't clobber a
 *  local edit that just hasn't pushed. A conversation that only exists on
 *  one side (created offline, or not yet synced elsewhere) is kept as-is. */
export function reconcileConversations(
  server: ChatConversation[],
  local: ChatConversation[],
): ChatConversation[] {
  const byId = new Map<string, ChatConversation>();
  for (const c of local) byId.set(c.id, c);
  for (const s of server) {
    const l = byId.get(s.id);
    if (!l || s.updatedAt >= l.updatedAt) {
      byId.set(s.id, s);
    }
    // else: local is newer (not pushed yet) — keep it, the pending push
    // will bring the server up to date shortly.
  }
  return Array.from(byId.values()).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

let cloudSyncStarted = false;
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();
const PUSH_DEBOUNCE_MS = 800;
const POLL_INTERVAL_MS = 15_000;

/** Debounced per-conversation push — coalesces rapid edits (typing,
 *  streaming tokens) into one request per conversation instead of one per
 *  keystroke, without holding up edits to *other* conversations behind the
 *  same timer the way a single whole-list debounce would. */
function schedulePush(conversation: ChatConversation) {
  const existing = pushTimers.get(conversation.id);
  if (existing) clearTimeout(existing);
  pushTimers.set(
    conversation.id,
    setTimeout(() => {
      pushTimers.delete(conversation.id);
      void pushChatConversation(conversation);
    }, PUSH_DEBOUNCE_MS),
  );
}

/** Call once from a client component mounted behind auth (the chat app
 *  shell) to turn on cross-device sync for the current session. Safe to
 *  call repeatedly — only the first call does anything. No-ops entirely in
 *  demo mode (Supabase not configured) or when signed out, in which case
 *  chat history stays exactly as local-only as it always was.
 *
 *  `onRemoteChange` is called with the reconciled list whenever the
 *  server's copy is pulled (initial load, and every subsequent poll) so
 *  the caller can update UI state + the localStorage cache without this
 *  module needing to know about React state. */
export async function initChatCloudSync(
  getLocal: () => ChatConversation[],
  onRemoteChange: (reconciled: ChatConversation[]) => void,
): Promise<void> {
  if (cloudSyncStarted || typeof window === "undefined") return;
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  cloudSyncStarted = true;

  async function syncFromServer() {
    const remote = await pullChatConversations();
    if (remote === null) return; // pull failed / not configured — keep local as-is
    const reconciled = reconcileConversations(remote, getLocal());
    onRemoteChange(reconciled);
    // Anything that was only local (created offline, or newer than the
    // server's copy) needs pushing up so the next pull elsewhere sees it.
    const remoteIds = new Set(remote.map((c) => c.id));
    for (const c of reconciled) {
      const serverCopy = remote.find((r) => r.id === c.id);
      if (
        !remoteIds.has(c.id) ||
        (serverCopy && serverCopy.updatedAt < c.updatedAt)
      ) {
        void pushChatConversation(c);
      }
    }
  }

  await syncFromServer();

  // Cross-device convergence: without a realtime subscription, a periodic
  // pull is what lets a second device's edits show up here without a
  // manual refresh. Paused while the tab is hidden so a background tab
  // doesn't keep polling.
  const interval = setInterval(() => {
    if (document.visibilityState === "visible") void syncFromServer();
  }, POLL_INTERVAL_MS);
  window.addEventListener("beforeunload", () => clearInterval(interval));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncFromServer();
  });
}

/** Push a single conversation's create/rename/message change to the
 *  server, debounced. No-ops silently when cloud sync isn't active (demo
 *  mode, signed out, or not yet initialized) — the local save this always
 *  runs alongside is what persists in that case. */
export function syncConversationToCloud(conversation: ChatConversation): void {
  if (!cloudSyncStarted) return;
  schedulePush(conversation);
}

/** Push a conversation delete to the server immediately (deletes aren't
 *  worth debouncing — there's nothing further to coalesce with). No-ops
 *  when cloud sync isn't active, same as syncConversationToCloud. */
export function syncConversationDeleteToCloud(id: string): void {
  if (!cloudSyncStarted) return;
  const pending = pushTimers.get(id);
  if (pending) {
    clearTimeout(pending);
    pushTimers.delete(id);
  }
  void deleteChatConversationRemote(id);
}
