"use client";

/**
 * CodeForge — client module
 * -------------------------
 * Talks to `/api/codeforge` (its own 7-key Groq pool — see
 * `getCodeForgeApiKeys` in `lib/supabase/config.ts`), fully independent of
 * `lib/ai.ts` (PromptForge's Improve/Rewrite/Expand/Shorten/Critique) and
 * `lib/forge-ai.ts` (Forge AI chat). Mirrors both modules' "just works with
 * zero setup" shape — if CodeForge's keys aren't configured (or a request
 * fails), tool calls and chat replies fall back to a local heuristic
 * instead of erroring out, so every page is usable before any key is set.
 *
 * Covers all 9 CodeForge features: the 8 one-shot tools (Generate Code,
 * Fix Bugs, Optimize Code, Explain Code, Convert Languages, Generate Unit
 * Tests, Generate Documentation, Review Code) plus the multi-turn AI
 * Coding Chat.
 */

export type CodeForgeTool =
  | "generate"
  | "fix"
  | "optimize"
  | "explain"
  | "convert"
  | "tests"
  | "docs"
  | "review";

export interface CodeForgeToolMeta {
  id: CodeForgeTool;
  label: string;
  description: string;
  inputLabel: string;
  inputPlaceholder: string;
  needsLanguage: boolean;
  needsTargetLanguage: boolean;
  outputIsCode: boolean;
  href: string;
}

export const CODEFORGE_TOOLS: CodeForgeToolMeta[] = [
  {
    id: "generate",
    label: "Generate Code",
    description: "Describe what you need — get working code back.",
    inputLabel: "What do you want to build?",
    inputPlaceholder: "e.g. A function that debounces another function by N milliseconds.",
    needsLanguage: true,
    needsTargetLanguage: false,
    outputIsCode: true,
    href: "/codeforge/generate",
  },
  {
    id: "fix",
    label: "Fix Bugs",
    description: "Paste broken code, get a fix and an explanation.",
    inputLabel: "Code with a bug",
    inputPlaceholder: "Paste the code that isn't working as expected…",
    needsLanguage: true,
    needsTargetLanguage: false,
    outputIsCode: true,
    href: "/codeforge/fix-bugs",
  },
  {
    id: "optimize",
    label: "Optimize Code",
    description: "Improve performance and readability without changing behavior.",
    inputLabel: "Code to optimize",
    inputPlaceholder: "Paste the code you'd like to speed up or clean up…",
    needsLanguage: true,
    needsTargetLanguage: false,
    outputIsCode: true,
    href: "/codeforge/optimize",
  },
  {
    id: "explain",
    label: "Explain Code",
    description: "Get a clear, plain-language walkthrough of what code does.",
    inputLabel: "Code to explain",
    inputPlaceholder: "Paste the code you want explained…",
    needsLanguage: true,
    needsTargetLanguage: false,
    outputIsCode: false,
    href: "/codeforge/explain",
  },
  {
    id: "convert",
    label: "Convert Languages",
    description: "Translate code from one language to another.",
    inputLabel: "Code to convert",
    inputPlaceholder: "Paste the code you want converted…",
    needsLanguage: true,
    needsTargetLanguage: true,
    outputIsCode: true,
    href: "/codeforge/convert",
  },
  {
    id: "tests",
    label: "Generate Unit Tests",
    description: "Get a thorough test suite for existing code.",
    inputLabel: "Code to test",
    inputPlaceholder: "Paste the function/class you want unit tests for…",
    needsLanguage: true,
    needsTargetLanguage: false,
    outputIsCode: true,
    href: "/codeforge/tests",
  },
  {
    id: "docs",
    label: "Generate Documentation",
    description: "Add doc comments and a usage example to your code.",
    inputLabel: "Code to document",
    inputPlaceholder: "Paste the code that needs documentation…",
    needsLanguage: true,
    needsTargetLanguage: false,
    outputIsCode: true,
    href: "/codeforge/docs",
  },
  {
    id: "review",
    label: "Review Code",
    description: "A senior-engineer-style review: correctness, style, security.",
    inputLabel: "Code to review",
    inputPlaceholder: "Paste the code you'd like reviewed…",
    needsLanguage: true,
    needsTargetLanguage: false,
    outputIsCode: false,
    href: "/codeforge/review",
  },
];

export function codeForgeToolMeta(tool: CodeForgeTool): CodeForgeToolMeta {
  const meta = CODEFORGE_TOOLS.find((t) => t.id === tool);
  if (!meta) throw new Error(`Unknown CodeForge tool: ${tool}`);
  return meta;
}

export interface CodeForgeToolResult {
  output: string;
  isCode: boolean;
  remote: boolean;
}

export interface RunToolOptions {
  language?: string;
  targetLanguage?: string;
}

/** Runs a CodeForge tool. Tries the real provider first (POST /api/codeforge,
 *  which uses the server-only CODEFORGE_GROQ_API_KEY_1..7 pool); if it isn't
 *  configured or the request fails, falls back to a local heuristic so
 *  every tool page keeps working with zero setup. */
export async function runCodeForgeTool(
  tool: CodeForgeTool,
  input: string,
  opts: RunToolOptions = {}
): Promise<CodeForgeToolResult> {
  const meta = codeForgeToolMeta(tool);
  if (!input.trim()) {
    return { output: "", isCode: meta.outputIsCode, remote: false };
  }

  try {
    const res = await fetch("/api/codeforge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "tool",
        tool,
        input,
        language: opts.language,
        targetLanguage: opts.targetLanguage,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.output === "string" && data.output.trim()) {
        return { output: data.output, isCode: meta.outputIsCode, remote: true };
      }
    }
  } catch {
    // fall through to local heuristic
  }

  return { output: localToolReply(tool, input, opts), isCode: meta.outputIsCode, remote: false };
}

/** Zero-setup fallback so every tool page is usable before
 *  CODEFORGE_GROQ_API_KEY_* is configured — deliberately simple/heuristic,
 *  same reasoning as lib/ai.ts's local transforms and lib/forge-ai.ts's
 *  local reply. */
function localToolReply(tool: CodeForgeTool, input: string, opts: RunToolOptions): string {
  const lang = opts.language?.trim() || "your language";
  const lines = input.trim().split("\n").length;
  const notice = "// CodeForge is running in demo mode (no CODEFORGE_GROQ_API_KEY configured yet).";

  switch (tool) {
    case "generate":
      return [
        notice,
        `// Request: ${firstLine(input)}`,
        "//",
        `// Once a real key is configured, CodeForge will generate working ${lang} code here.`,
        "// For now, here's a starting skeleton to build from:",
        "",
        "function solution(/* params */) {",
        "  // TODO: implement",
        "}",
      ].join("\n");
    case "fix":
      return [
        `${notice} This is a heuristic pass, not a real fix.`,
        "",
        input,
        "",
        `// Heuristic notes (${lines} line${lines === 1 ? "" : "s"} scanned):`,
        "// - Double-check variable names for typos and off-by-one bounds.",
        "// - Verify every branch has a matching close and a return where expected.",
        "// - Set CODEFORGE_GROQ_API_KEY_1 (or _1.._7) for a real automated fix + explanation.",
      ].join("\n");
    case "optimize":
      return [
        `${notice} This is a heuristic pass, not a real optimization.`,
        "",
        input,
        "",
        "// Heuristic notes:",
        "// - Look for repeated work inside loops that could be hoisted out or memoized.",
        "// - Prefer built-in/standard-library operations over hand-rolled equivalents.",
        "// - Set a real key to get a genuine optimized rewrite + rationale.",
      ].join("\n");
    case "explain":
      return [
        notice,
        "",
        `This snippet is ${lines} line${lines === 1 ? "" : "s"} long. In demo mode, CodeForge can't produce a real` +
          " walkthrough — set CODEFORGE_GROQ_API_KEY_1 (or up to _7) to get a genuine explanation of what this code" +
          " does, step by step, plus any edge cases worth knowing about.",
      ].join("\n");
    case "convert":
      return [
        notice,
        `// Converting ${lang} → ${opts.targetLanguage || "target language"} needs a real model — set a key to enable it.`,
        "// Original:",
        "",
        input,
      ].join("\n");
    case "tests":
      return [
        notice,
        "// Once a real key is configured, a full test suite for the code below will appear here.",
        "",
        "// describe(\"solution\", () => {",
        "//   it(\"handles the happy path\", () => { /* TODO */ });",
        "//   it(\"handles edge cases\", () => { /* TODO */ });",
        "// });",
      ].join("\n");
    case "docs":
      return [
        notice,
        "/**",
        " * TODO: description",
        " * Set CODEFORGE_GROQ_API_KEY_1 (or up to _7) for a real generated doc comment + usage example.",
        " */",
        "",
        input,
      ].join("\n");
    case "review":
      return [
        notice,
        "",
        `A demo-mode pass over ${lines} line${lines === 1 ? "" : "s"} can't produce a genuine review. Once a real key` +
          " is configured, CodeForge will return a structured, senior-engineer-style review covering correctness," +
          " readability, error handling, performance, and security.",
      ].join("\n");
  }
}

function firstLine(text: string): string {
  const line = text.trim().split("\n")[0] ?? "";
  return line.length > 80 ? `${line.slice(0, 80)}…` : line;
}

// --- AI Coding Chat --------------------------------------------------------

export interface CodeForgeChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

function id(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const CHAT_STORAGE_KEY = "nexprompt:codeforge:chat";

/** Loads the saved AI Coding Chat conversation. Returns [] on the server,
 *  on first load, or if storage is unavailable/corrupt. Chat history is
 *  local to this browser, same reasoning as Forge AI's per-prompt
 *  conversations — it's chat scratch space, not synced workspace data. */
export function loadCodeForgeChat(): CodeForgeChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is CodeForgeChatMessage =>
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

export function saveCodeForgeChat(messages: CodeForgeChatMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Storage unavailable (private browsing, quota) — history just won't persist.
  }
}

export function clearCodeForgeChat(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CHAT_STORAGE_KEY);
  } catch {
    // no-op
  }
}

export function makeCodeForgeMessage(role: CodeForgeChatMessage["role"], content: string): CodeForgeChatMessage {
  return { id: id(), role, content, createdAt: new Date().toISOString() };
}

/** Sends the full conversation to CodeForge's own endpoint and returns the
 *  assistant's reply text. Falls back to a local heuristic reply if the
 *  provider isn't configured or the request fails. */
export async function sendCodeForgeChatMessage(history: CodeForgeChatMessage[]): Promise<string> {
  try {
    const res = await fetch("/api/codeforge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "chat",
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.output === "string" && data.output.trim()) return data.output.trim();
    }
  } catch {
    // fall through to local reply
  }
  return localChatReply(history);
}

function localChatReply(history: CodeForgeChatMessage[]): string {
  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const lower = lastUser.toLowerCase();

  let focus = "the details of what you just asked";
  if (lower.includes("bug") || lower.includes("error") || lower.includes("fix")) focus = "the Fix Bugs tool for a real automated fix";
  else if (lower.includes("test")) focus = "the Generate Unit Tests tool";
  else if (lower.includes("slow") || lower.includes("perf") || lower.includes("optimi")) focus = "the Optimize Code tool";
  else if (lower.includes("explain") || lower.includes("what does")) focus = "the Explain Code tool";
  else if (lower.includes("review")) focus = "the Review Code tool";
  else if (lower.includes("convert") || lower.includes("translate") || lower.includes("port")) focus = "the Convert Languages tool";
  else if (lower.includes("doc")) focus = "the Generate Documentation tool";
  else if (lower.includes("generate") || lower.includes("write") || lower.includes("build")) focus = "the Generate Code tool";

  return [
    "AI Coding Chat is running in demo mode (no CODEFORGE_GROQ_API_KEY configured yet), so this is a heuristic reply rather than a real model response.",
    `For ${focus}, you'll get a much more useful result from one of the dedicated tools in the CodeForge sidebar — each is tuned specifically for that job.`,
    "Once real keys are configured (CODEFORGE_GROQ_API_KEY_1 through _7 supported for automatic fallback), this chat becomes a full coding assistant.",
  ].join(" ");
}

/** Pulls the first fenced code block out of an assistant reply, if
 *  present — used for one-click "copy code" on chat messages. Falls back
 *  to the whole message if there's no code block. */
export function extractCodeBlock(assistantContent: string): string {
  const match = assistantContent.match(/```(?:[\w-]*\n)?([\s\S]*?)```/);
  if (match && match[1].trim()) return match[1].trim();
  return assistantContent.trim();
}
