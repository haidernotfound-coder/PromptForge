"use client";

/**
 * Forge AI — client module
 * ------------------------
 * Talks to `/api/forge-ai` (its own Groq key pool — see
 * `getForgeAiApiKeys` in `lib/supabase/config.ts`), independent of
 * `lib/ai.ts`'s Improve/Rewrite/Expand/Shorten/Critique calls to
 * `/api/ai`. Mirrors that module's "just works with zero setup" shape —
 * if Forge AI's keys aren't configured (or the call fails), replies fall
 * back to a local heuristic instead of erroring out.
 *
 * Conversations persist per-prompt in localStorage, independent of the
 * main Supabase-synced Zustand store (same reasoning as recipe
 * favorites: this is local chat history, not workspace data).
 */

import { buildAttachmentPayload, type ChatAttachment } from "@/lib/attachments";

export interface ForgeChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  /** Lightweight metadata only (name/size/kind) — kept small since this
   *  persists in localStorage; the actual file contents aren't re-sent
   *  on reload. */
  attachments?: { name: string; size: number; kind: string }[];
}

function id(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const STORAGE_PREFIX = "nexprompt:forge-ai:";

function storageKey(promptKey: string): string {
  return `${STORAGE_PREFIX}${promptKey}`;
}

/** Loads the saved conversation for a given prompt (or the "new" draft key
 *  for a not-yet-created prompt). Returns [] on the server, on first load,
 *  or if storage is unavailable/corrupt. */
export function loadConversation(promptKey: string): ForgeChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(promptKey));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is ForgeChatMessage =>
        Boolean(m) &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        typeof m.id === "string" &&
        typeof m.createdAt === "string"
    );
  } catch {
    return [];
  }
}

export function saveConversation(promptKey: string, messages: ForgeChatMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(promptKey), JSON.stringify(messages));
  } catch {
    // Storage unavailable (private browsing, quota) — history just won't persist.
  }
}

export function clearConversation(promptKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(promptKey));
  } catch {
    // no-op
  }
}

export function makeMessage(
  role: ForgeChatMessage["role"],
  content: string,
  attachments?: ChatAttachment[]
): ForgeChatMessage {
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

/** Sends the full conversation (plus the current prompt body for context)
 *  to Forge AI's own endpoint. Real provider/attachment failures are surfaced
 *  to the UI instead of being mislabeled as demo-mode replies. */
export async function sendForgeAiMessage(
  promptBody: string,
  history: ForgeChatMessage[],
  attachments: ChatAttachment[] = []
): Promise<string> {
  try {
    const { contextBlocks, images, documents, errors } = buildAttachmentPayload(attachments);
    if (errors.length > 0) throw new Error(errors.join(" "));
    const res = await fetch("/api/forge-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        promptBody,
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

    const serverMessage = typeof data.error === "string" && data.error.trim()
      ? data.error.trim()
      : `Forge AI request failed (${res.status})`;
    throw new Error(serverMessage);
  } catch (err) {
    throw err instanceof Error ? err : new Error("Forge AI request failed");
  }
}

/** Pulls a proposed revised prompt out of an assistant reply, if present —
 *  looks for the first fenced code block, per the system prompt's
 *  instruction to wrap revised-prompt proposals that way. Falls back to
 *  the whole message if there's no code block, so Apply always has
 *  something reasonable to use. */
export function extractApplicableText(assistantContent: string): string {
  const match = assistantContent.match(/```(?:[\w-]*\n)?([\s\S]*?)```/);
  if (match && match[1].trim()) return match[1].trim();
  return assistantContent.trim();
}
