import { NextResponse } from "next/server";
import { isAiConfigured } from "@/lib/supabase/config";

/**
 * Phase 7 AI provider wiring.
 *
 * Runs Improve / Rewrite / Expand / Shorten against the real Groq API
 * (Llama 3.1 8B Instant) using a server-only `GROQ_API_KEY` (see
 * `.env.example`) — the key never reaches the browser. If it's not
 * configured, callers (see `src/lib/ai.ts`) fall back to the Phase 4 local
 * simulation so the AI panel keeps working with zero setup.
 */

export const runtime = "nodejs";

type AiActionType = "improve" | "rewrite" | "expand" | "shorten";
type RewriteTone = "professional" | "casual" | "confident" | "friendly" | "concise";

const ACTION_INSTRUCTIONS: Record<AiActionType, string> = {
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

export async function POST(request: Request) {
  if (!isAiConfigured()) {
    return NextResponse.json({ error: "AI provider not configured" }, { status: 501 });
  }

  let body: { action?: AiActionType; input?: string; tone?: RewriteTone };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, input, tone } = body;
  if (!action || !ACTION_INSTRUCTIONS[action]) {
    return NextResponse.json({ error: "Invalid or missing action" }, { status: 400 });
  }
  if (typeof input !== "string" || !input.trim()) {
    return NextResponse.json({ error: "Missing input" }, { status: 400 });
  }
  // Guard against runaway costs from an accidentally huge paste.
  if (input.length > 20_000) {
    return NextResponse.json({ error: "Prompt is too long" }, { status: 413 });
  }

  const instruction =
    action === "rewrite"
      ? `${ACTION_INSTRUCTIONS.rewrite} Use ${TONE_INSTRUCTIONS[tone ?? "professional"]}.`
      : ACTION_INSTRUCTIONS[action];

  const systemPrompt = [
    "You are the AI assist engine inside PromptForge, a prompt-management tool.",
    instruction,
    "The prompt may contain {{variable}} placeholders — preserve every one of them exactly, character for character, in the output.",
    "Respond with ONLY the resulting prompt text. No preamble, no explanation, no markdown code fences, no quotes around it.",
  ].join(" ");

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
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
      return NextResponse.json({ error: "AI provider request failed" }, { status: 502 });
    }

    const data = await response.json();
    const output = (data.choices?.[0]?.message?.content ?? "").trim();

    if (!output) {
      return NextResponse.json({ error: "AI provider returned no output" }, { status: 502 });
    }

    return NextResponse.json({ output });
  } catch (err) {
    console.error("Groq API request failed", err);
    return NextResponse.json({ error: "AI provider request failed" }, { status: 502 });
  }
}
