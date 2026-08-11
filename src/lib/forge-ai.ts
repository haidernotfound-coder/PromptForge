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
 *  to Forge AI's own endpoint and returns the assistant's reply text.
 *  Falls back to a local heuristic reply if the provider isn't configured
 *  or the request fails, so the panel is never a dead end. */
export async function sendForgeAiMessage(
  promptBody: string,
  history: ForgeChatMessage[],
  attachments: ChatAttachment[] = []
): Promise<string> {
  try {
    const { contextBlocks, images, documents } = buildAttachmentPayload(attachments);
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
    if (res.ok) {
      const data = await res.json();
      if (typeof data.output === "string" && data.output.trim()) return data.output.trim();
    }
  } catch {
    // fall through to local reply
  }
  return localForgeReply(promptBody, history);
}

/** Zero-setup fallback so the panel is usable before Forge AI's keys are
 *  configured — deliberately simple/heuristic rather than trying to fake
 *  a real conversational model. */
function localForgeReply(promptBody: string, history: ForgeChatMessage[]): string {
  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const words = promptBody.trim() ? promptBody.trim().split(/\s+/).length : 0;
  const variableCount = new Set(promptBody.match(/\{\{\s*[\w.-]+\s*\}\}/g) ?? []).size;

  if (!promptBody.trim()) {
    return "Forge AI is running in demo mode (no FORGE_AI_GROQ_API_KEY configured yet), so this is a canned reply: your prompt body is currently empty — write something in the editor and I can help you refine it, or ask me for a starting structure.";
  }

  const lower = lastUser.toLowerCase();
  let focus = "structure and clarity";
  if (lower.includes("short")) focus = "trimming it down";
  else if (lower.includes("example")) focus = "adding a concrete example";
  else if (lower.includes("variable")) focus = "how the {{variables}} are used";
  else if (lower.includes("tone")) focus = "adjusting the tone";

  return [
    "Forge AI is running in demo mode (no FORGE_AI_GROQ_API_KEY configured yet), so this is a heuristic reply rather than a real model response.",
    `Your current prompt is about ${words} words${variableCount ? ` with ${variableCount} variable${variableCount === 1 ? "" : "s"}` : ""}.`,
    `Once real keys are configured, I'd focus on ${focus} based on what you just asked. For now, try the Critic (score + suggestions) or the Improve action in the AI panel below the editor for a real model pass.`,
  ].join(" ");
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
