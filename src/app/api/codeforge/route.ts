import { NextResponse } from "next/server";
import { isCodeForgeConfigured, getCodeForgeApiKeys, getCodeForgeKeyLabels } from "@/lib/supabase/config";
import { getLastGoodKeyIndex, setLastGoodKeyIndex } from "@/lib/admin/groq-router-state";
import { recordEvent, recordGroqUsage, getSystemSettings, type EventType } from "@/lib/admin/store";
import { getAppSessionOrNull } from "@/lib/session";

/**
 * CodeForge provider wiring — the second NexPrompt product's API surface.
 *
 * A deliberate sibling of `src/app/api/ai/route.ts` and
 * `src/app/api/forge-ai/route.ts`, not a refactor of either: it covers
 * eight one-shot code tools (Generate, Fix Bugs, Optimize, Explain,
 * Convert, Unit Tests, Documentation, Review) *and* the multi-turn AI
 * Coding Chat behind a single endpoint, and authenticates with its own
 * `CODEFORGE_GROQ_API_KEY_1`..`_7` pool (see `getCodeForgeApiKeys` in
 * `lib/supabase/config.ts`) — fully independent of the `GROQ_API_KEY_*`
 * pool PromptForge's Improve/Rewrite/Expand/Shorten/Critique use and the
 * `FORGE_AI_GROQ_API_KEY_*` pool Forge AI's chat uses. Same
 * retry-on-429/401/403-across-every-configured-key shape as those two
 * routes, since that behavior is exactly what's wanted here too.
 */

export const runtime = "nodejs";

/** Lets the client show real vs demo-mode copy without ever exposing the
 *  keys themselves. */
export async function GET() {
  return NextResponse.json({ configured: isCodeForgeConfigured() });
}

export type CodeForgeTool =
  | "generate"
  | "fix"
  | "optimize"
  | "explain"
  | "convert"
  | "tests"
  | "docs"
  | "review";

const TOOL_EVENT_TYPES: Record<CodeForgeTool, EventType> = {
  generate: "codeforge.generate",
  fix: "codeforge.fix",
  optimize: "codeforge.optimize",
  explain: "codeforge.explain",
  convert: "codeforge.convert",
  tests: "codeforge.tests",
  docs: "codeforge.docs",
  review: "codeforge.review",
};

function toolSystemPrompt(tool: CodeForgeTool, language: string, targetLanguage: string): string {
  const langHint = language ? ` The code is written in ${language}.` : "";
  const base = "You are CodeForge, an expert pair-programmer embedded in NexPrompt.";
  switch (tool) {
    case "generate":
      return [
        base,
        "Generate clean, correct, idiomatic code that satisfies the user's request.",
        language ? `Write it in ${language}.` : "Infer the most sensible language from the request, or default to a widely-used one if unclear.",
        "Respond with ONLY the code in a single fenced code block (with a language tag) — no preamble, no explanation before or after, unless a brief usage comment inside the code block is genuinely useful.",
      ].join(" ");
    case "fix":
      return [
        base,
        `Find and fix the bug(s) in the given code.${langHint}`,
        "Preserve the original structure, style, and intent as much as possible — make the minimal correct change.",
        "Respond with the corrected code in a single fenced code block, followed by a short bullet list explaining what was wrong and what you changed.",
      ].join(" ");
    case "optimize":
      return [
        base,
        `Optimize the given code for performance and/or readability without changing its external behavior.${langHint}`,
        "Respond with the optimized code in a single fenced code block, followed by a short bullet list of what changed and why it's better.",
      ].join(" ");
    case "explain":
      return [
        base,
        `Explain what the given code does, clearly and precisely.${langHint}`,
        "Walk through it logically (overall purpose first, then key parts), and call out any non-obvious behavior, edge cases, or side effects.",
        "Respond in plain prose with short paragraphs and/or a bullet list — do not just restate the code.",
      ].join(" ");
    case "convert":
      return [
        base,
        `Convert (translate) the given code from ${language || "its current language"} to ${targetLanguage || "the requested target language"}, preserving behavior exactly.`,
        "Use idiomatic patterns and standard-library equivalents of the target language rather than a literal line-by-line port where a more natural equivalent exists.",
        "Respond with ONLY the converted code in a single fenced code block (with a language tag) — no preamble or explanation.",
      ].join(" ");
    case "tests":
      return [
        base,
        `Write a thorough unit test suite for the given code, using the most standard/idiomatic testing framework for its language.${langHint}`,
        "Cover the happy path, edge cases, and error conditions. Add brief comments explaining non-obvious test cases.",
        "Respond with ONLY the test code in a single fenced code block (with a language tag) — no preamble or explanation.",
      ].join(" ");
    case "docs":
      return [
        base,
        `Write clear documentation for the given code: a doc comment/docstring block (in the idiomatic style for its language) covering purpose, parameters, return value, and any thrown errors/exceptions, plus a short usage example where useful.${langHint}`,
        "Respond with the documented version of the code (original code with documentation added) in a single fenced code block.",
      ].join(" ");
    case "review":
      return [
        base,
        `Perform a code review of the given code, as a senior engineer would: correctness, edge cases, readability, naming, error handling, performance, and security.${langHint}`,
        "Respond in prose with a short overall assessment, then a bullet list of specific, actionable findings ordered roughly by severity (most important first). Reference specific lines/parts where possible. Do not rewrite the whole file unless a snippet is the clearest way to illustrate a fix.",
      ].join(" ");
  }
}

const CHAT_SYSTEM_PROMPT = [
  "You are CodeForge's AI Coding Chat, a focused coding assistant embedded in NexPrompt.",
  "Help the user with anything code-related: writing, debugging, refactoring, explaining, reviewing, testing, or planning code, and general programming/CS questions.",
  "Be direct and concise — this is a working session, not an essay. Prefer code blocks (with language tags) for any code you provide.",
  "When you're not sure what language or framework the user means, make a reasonable assumption and say so briefly rather than stalling on a clarifying question.",
].join(" ");

type GroqCallResult =
  | { ok: true; output: string }
  | { ok: false; exhausted: true } // 401/403/429 — try the next key
  | { ok: false; exhausted: false; status: number }; // other failure — stop retrying

async function callGroq(
  apiKey: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[]
): Promise<GroqCallResult> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      max_tokens: 3000,
      temperature: 0.3,
      messages,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("CodeForge Groq API error", response.status, detail);
    if (response.status === 429 || response.status === 401 || response.status === 403) {
      return { ok: false, exhausted: true };
    }
    return { ok: false, exhausted: false, status: response.status };
  }

  const data = await response.json();
  const output = (data.choices?.[0]?.message?.content ?? "").trim();
  if (!output) {
    return { ok: false, exhausted: false, status: 502 };
  }
  return { ok: true, output };
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type RequestBody =
  | {
      mode: "tool";
      tool?: CodeForgeTool;
      input?: string;
      language?: string;
      targetLanguage?: string;
    }
  | {
      mode: "chat";
      messages?: ChatMessage[];
    };

export async function POST(request: Request) {
  if (!isCodeForgeConfigured()) {
    return NextResponse.json({ error: "CodeForge provider not configured" }, { status: 501 });
  }

  const settings = await getSystemSettings();
  if (settings.maintenanceMode) {
    return NextResponse.json({ error: "AI features are temporarily in maintenance mode" }, { status: 503 });
  }
  if (!settings.codeforgeEnabled) {
    return NextResponse.json({ error: "CodeForge is currently disabled" }, { status: 403 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let messages: { role: "system" | "user" | "assistant"; content: string }[];
  let eventType: EventType;

  if (body.mode === "tool") {
    const tool = body.tool;
    const input = body.input;
    if (!tool || !TOOL_EVENT_TYPES[tool]) {
      return NextResponse.json({ error: "Invalid or missing tool" }, { status: 400 });
    }
    if (typeof input !== "string" || !input.trim()) {
      return NextResponse.json({ error: "Missing input" }, { status: 400 });
    }
    if (input.length > 30_000) {
      return NextResponse.json({ error: "Input is too long" }, { status: 413 });
    }
    if (tool === "convert" && !body.targetLanguage?.trim()) {
      return NextResponse.json({ error: "Missing targetLanguage for convert" }, { status: 400 });
    }
    const system = toolSystemPrompt(tool, body.language?.trim() ?? "", body.targetLanguage?.trim() ?? "");
    messages = [
      { role: "system", content: system },
      { role: "user", content: input },
    ];
    eventType = TOOL_EVENT_TYPES[tool];
  } else if (body.mode === "chat") {
    const validRoles = new Set(["user", "assistant"]);
    const cleanMessages = (body.messages ?? []).filter(
      (m): m is ChatMessage =>
        Boolean(m) && validRoles.has(m.role) && typeof m.content === "string" && m.content.trim().length > 0
    );
    if (cleanMessages.length === 0) {
      return NextResponse.json({ error: "Missing messages" }, { status: 400 });
    }
    const totalLength = cleanMessages.reduce((sum, m) => sum + m.content.length, 0);
    if (totalLength > 60_000) {
      return NextResponse.json({ error: "Conversation is too long" }, { status: 413 });
    }
    messages = [{ role: "system", content: CHAT_SYSTEM_PROMPT }, ...cleanMessages];
    eventType = "codeforge.chat";
  } else {
    return NextResponse.json({ error: "Invalid or missing mode" }, { status: 400 });
  }

  const session = await getAppSessionOrNull();
  const keyLabels = getCodeForgeKeyLabels();

  try {
    const keys = getCodeForgeApiKeys();
    // Start from the last key that worked, wrapping around, so a healthy
    // key found mid-list doesn't get bypassed every request.
    const startIndex = getLastGoodKeyIndex("codeforge");
    const order = keys.map((_, i) => (startIndex + i) % keys.length);

    let lastFailure: { exhausted: boolean; status?: number } | null = null;

    for (const i of order) {
      const result = await callGroq(keys[i], messages);
      await recordGroqUsage({ pool: "codeforge", keyLabel: keyLabels[i] ?? `key-${i + 1}`, success: result.ok });

      if (result.ok) {
        setLastGoodKeyIndex("codeforge", i); // remember this key for next time
        await recordEvent({ userLabel: session?.email, eventType, success: true });
        return NextResponse.json({ output: result.output });
      }

      lastFailure = result.exhausted ? { exhausted: true } : { exhausted: false, status: result.status };

      if (!result.exhausted) {
        // A non-quota failure (bad request, provider outage, etc.) — no
        // point hammering every remaining key with the same broken request.
        break;
      }
      // Otherwise this key is rate-limited/invalid — loop continues and
      // instantly tries the next configured key.
    }

    await recordEvent({
      userLabel: session?.email,
      eventType: "ai.error",
      success: false,
      metadata: { source: "codeforge", reason: lastFailure?.exhausted ? "rate_limited" : "provider_error" },
    });

    if (lastFailure && !lastFailure.exhausted) {
      return NextResponse.json({ error: "CodeForge provider request failed" }, { status: lastFailure.status ?? 502 });
    }
    // Every configured key was exhausted (rate-limited or invalid).
    return NextResponse.json(
      { error: "All configured CodeForge provider keys are currently rate-limited or invalid" },
      { status: 429 }
    );
  } catch (err) {
    console.error("CodeForge Groq API request failed", err);
    await recordEvent({
      userLabel: session?.email,
      eventType: "ai.error",
      success: false,
      metadata: { source: "codeforge", reason: "exception" },
    });
    return NextResponse.json({ error: "CodeForge provider request failed" }, { status: 502 });
  }
}
