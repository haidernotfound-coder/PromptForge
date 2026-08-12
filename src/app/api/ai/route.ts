import { NextResponse } from "next/server";
import { isAiConfigured, getGroqApiKeys, getGroqKeyLabels } from "@/lib/supabase/config";
import { getLastGoodKeyIndex, setLastGoodKeyIndex } from "@/lib/admin/groq-router-state";
import { recordEvent, recordGroqUsage, getSystemSettings, type EventType } from "@/lib/admin/store";
import { getAppSessionOrNull } from "@/lib/session";

/**
 * Phase 7 AI provider wiring.
 *
 * Runs Improve / Rewrite / Expand / Shorten against the real Groq API
 * (Llama 3.1 8B Instant) using server-only `GROQ_API_KEY_1`..`GROQ_API_KEY_5`
 * (see `.env.example`) — keys never reach the browser. If none are
 * configured, callers (see `src/lib/ai.ts`) fall back to the Phase 4 local
 * simulation so the AI panel keeps working with zero setup.
 *
 * Multi-key fallback: up to 5 Groq API keys can be configured. If a key
 * hits its daily/rate limit (HTTP 429) or is otherwise rejected (401/403),
 * the request instantly retries with the next configured key in the same
 * request — no user-facing failure and no waiting for the exhausted key to
 * reset. The last key that worked is remembered (per server instance) so
 * later requests start there instead of always retrying exhausted keys
 * first.
 */

export const runtime = "nodejs";

/** Lets the client know whether a real provider is wired up, without ever
 *  exposing GROQ_API_KEY itself (that stays server-only). Used by the AI
 *  assist panel to show accurate "demo mode" vs "live" copy. */
export async function GET() {
  return NextResponse.json({ configured: isAiConfigured() });
}

type AiActionType = "improve" | "rewrite" | "expand" | "shorten" | "critique";
type RewriteTone = "professional" | "casual" | "confident" | "friendly" | "concise";

type TransformAction = Exclude<AiActionType, "critique">;

const ACTION_INSTRUCTIONS: Record<TransformAction, string> = {
  improve:
    "Tighten and clarify the wording of this prompt without changing its meaning or intent. Fix awkward phrasing, remove filler words, and make instructions more precise.",
  rewrite: "Rewrite this prompt in the given tone, preserving its meaning and intent.",
  expand:
    "Expand this prompt with additional useful guidance (e.g. asking for specificity, reasoning steps, or handling of ambiguous/missing information), while preserving the original intent.",
  shorten: "Shorten this prompt as much as possible while preserving its core meaning and intent.",
};

const TONE_INSTRUCTIONS: Record<RewriteTone, string> = {
  professional: "a professional, polished tone",
  casual: "a casual, conversational tone",
  confident: "a confident, directive tone",
  friendly: "a warm, friendly tone",
  concise: "a terse, concise tone with no unnecessary words",
};

const CRITIQUE_SYSTEM_PROMPT = [
  "You are the AI Prompt Critic inside NexPrompt, a prompt-management tool.",
  "Analyze the quality of the given prompt as an instruction for a large language model.",
  "The prompt may contain {{variable}} placeholders — treat those as intentional reusable slots, not a flaw.",
  "Respond with ONLY a single valid JSON object (no markdown fences, no preamble, no trailing text) with exactly these fields:",
  '"score" (integer 0-100 overall quality), "strengths" (array of 2-4 short strings), "weaknesses" (array of 2-4 short strings),',
  '"suggestions" (array of 2-5 short, actionable strings), and "fixedPrompt" (a string containing a rewritten version of the prompt',
  "that applies the suggestions while preserving the original intent and every {{variable}} placeholder exactly).",
].join(" ");

const ACTION_EVENT_TYPES: Record<AiActionType, EventType> = {
  improve: "prompt.improved",
  rewrite: "prompt.rewritten",
  expand: "prompt.expanded",
  shorten: "prompt.shortened",
  critique: "prompt.critiqued",
};

type GroqCallResult =
  | { ok: true; output: string }
  | { ok: false; exhausted: true } // 401/403/429 — try the next key
  | { ok: false; exhausted: false; status: number }; // other failure — stop retrying

async function callGroq(apiKey: string, systemPrompt: string, input: string): Promise<GroqCallResult> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      // llama-3.1-8b-instant was deprecated by Groq (announced 2026-06-17);
      // see console.groq.com/docs/deprecations. openai/gpt-oss-20b is Groq's
      // recommended replacement.
      model: "openai/gpt-oss-20b",
      max_tokens: 2000,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: input },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Groq API error", response.status, detail);
    // 429 = rate/daily limit hit. 401/403 = invalid or revoked key.
    // Either way, this key is done for now — move on to the next one.
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

export async function POST(request: Request) {
  if (!isAiConfigured()) {
    return NextResponse.json({ error: "AI provider not configured" }, { status: 501 });
  }

  const settings = await getSystemSettings();
  if (settings.maintenanceMode) {
    return NextResponse.json({ error: "AI features are temporarily in maintenance mode" }, { status: 503 });
  }

  let body: { action?: AiActionType; input?: string; tone?: RewriteTone };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, input, tone } = body;
  const isCritique = action === "critique";
  if (!action || (!isCritique && !ACTION_INSTRUCTIONS[action as TransformAction])) {
    return NextResponse.json({ error: "Invalid or missing action" }, { status: 400 });
  }
  if (typeof input !== "string" || !input.trim()) {
    return NextResponse.json({ error: "Missing input" }, { status: 400 });
  }
  // Guard against runaway costs from an accidentally huge paste.
  if (input.length > 20_000) {
    return NextResponse.json({ error: "Prompt is too long" }, { status: 413 });
  }
  if (isCritique && !settings.criticEnabled) {
    return NextResponse.json({ error: "Critic is currently disabled" }, { status: 403 });
  }

  const systemPrompt = isCritique
    ? CRITIQUE_SYSTEM_PROMPT
    : [
        "You are the AI assist engine inside NexPrompt, a prompt-management tool.",
        action === "rewrite"
          ? `${ACTION_INSTRUCTIONS.rewrite} Use ${TONE_INSTRUCTIONS[tone ?? "professional"]}.`
          : ACTION_INSTRUCTIONS[action as TransformAction],
        "The prompt may contain {{variable}} placeholders — preserve every one of them exactly, character for character, in the output.",
        "Respond with ONLY the resulting prompt text. No preamble, no explanation, no markdown code fences, no quotes around it.",
      ].join(" ");

  const eventType = ACTION_EVENT_TYPES[action];
  const session = await getAppSessionOrNull();
  const keyLabels = getGroqKeyLabels();

  try {
    const keys = getGroqApiKeys();
    // Start from the last key that worked, wrapping around, so a healthy
    // key found mid-list doesn't get bypassed every request.
    const startIndex = getLastGoodKeyIndex("ai");
    const order = keys.map((_, i) => (startIndex + i) % keys.length);

    let lastFailure: { exhausted: boolean; status?: number } | null = null;

    for (const i of order) {
      const result = await callGroq(keys[i], systemPrompt, input);
      await recordGroqUsage({ pool: "ai", keyLabel: keyLabels[i] ?? `key-${i + 1}`, success: result.ok });

      if (result.ok) {
        setLastGoodKeyIndex("ai", i); // remember this key for next time
        await recordEvent({ userLabel: session?.email, eventType, success: true });
        return NextResponse.json({ output: result.output });
      }

      lastFailure = result.exhausted
        ? { exhausted: true }
        : { exhausted: false, status: result.status };

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
      metadata: { action, reason: lastFailure?.exhausted ? "rate_limited" : "provider_error" },
    });

    if (lastFailure && !lastFailure.exhausted) {
      return NextResponse.json({ error: "AI provider request failed" }, { status: lastFailure.status ?? 502 });
    }
    // Every configured key was exhausted (rate-limited or invalid).
    return NextResponse.json(
      { error: "All configured AI provider keys are currently rate-limited or invalid" },
      { status: 429 }
    );
  } catch (err) {
    console.error("Groq API request failed", err);
    await recordEvent({
      userLabel: session?.email,
      eventType: "ai.error",
      success: false,
      metadata: { action, reason: "exception" },
    });
    return NextResponse.json({ error: "AI provider request failed" }, { status: 502 });
  }
}
