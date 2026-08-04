import { NextResponse } from "next/server";
import { isStudyForgeConfigured, getStudyForgeApiKeys, getStudyForgeKeyLabels } from "@/lib/supabase/config";
import { getLastGoodKeyIndex, setLastGoodKeyIndex } from "@/lib/admin/groq-router-state";
import { recordEvent, recordGroqUsage, getSystemSettings, type EventType } from "@/lib/admin/store";
import { getAppSessionOrNull } from "@/lib/session";

/**
 * StudyForge provider wiring — the third NexPrompt product's API surface.
 *
 * A deliberate sibling of `src/app/api/ai/route.ts`, `src/app/api/forge-ai/route.ts`,
 * and `src/app/api/codeforge/route.ts`, not a refactor of any of them: it
 * covers eight one-shot study tools (Explain Concepts, Notes Generator,
 * Flashcards, Quiz Generator, Homework Helper, Study Planner, Notes
 * Summarizer, Exam Practice) *and* the multi-turn AI Study Chat behind a
 * single endpoint, and authenticates with its own `STUDYFORGE_GROQ_API_KEY_1`
 * .. `_10` pool (see `getStudyForgeApiKeys` in `lib/supabase/config.ts`) —
 * fully independent of the other three Groq pools. Same
 * retry-on-429/401/403-across-every-configured-key shape as those routes,
 * since that behavior is exactly what's wanted here too.
 */

export const runtime = "nodejs";

/** Lets the client show real vs demo-mode copy without ever exposing the
 *  keys themselves. */
export async function GET() {
  return NextResponse.json({ configured: isStudyForgeConfigured() });
}

export type StudyForgeTool =
  | "explain"
  | "notes"
  | "flashcards"
  | "quiz"
  | "homework"
  | "planner"
  | "summarize"
  | "exam";

const TOOL_EVENT_TYPES: Record<StudyForgeTool, EventType> = {
  explain: "studyforge.explain",
  notes: "studyforge.notes",
  flashcards: "studyforge.flashcards",
  quiz: "studyforge.quiz",
  homework: "studyforge.homework",
  planner: "studyforge.planner",
  summarize: "studyforge.summarize",
  exam: "studyforge.exam",
};

function toolSystemPrompt(tool: StudyForgeTool, detail: string): string {
  const detailHint = detail ? ` Additional context/preferences from the student: ${detail}.` : "";
  const base = "You are StudyForge, an expert, encouraging tutor embedded in NexPrompt.";
  switch (tool) {
    case "explain":
      return [
        base,
        `Explain the given concept or topic clearly and precisely, in plain language.${detailHint}`,
        "Structure it logically: a one-sentence overview first, then a clear breakdown, then a simple" +
          " real-world example or analogy. Define any unavoidable jargon the first time you use it.",
        "Respond in prose with short paragraphs and/or a bullet list.",
      ].join(" ");
    case "notes":
      return [
        base,
        `Turn the given topic or reading into clean, well-structured study notes.${detailHint}`,
        "Use headings and bullet points. Bold key terms. Keep it scannable and exam-ready — no filler.",
        "Respond in Markdown.",
      ].join(" ");
    case "flashcards":
      return [
        base,
        `Generate a deck of flashcards on the given topic or material.${detailHint}`,
        "Respond with ONLY a single JSON object of the exact shape {\"cards\":[{\"front\":\"...\",\"back\":\"...\"}]}" +
          " — no markdown, no numbered list, no commentary before or after it, and no code fences.",
        "Each card's \"front\" is a short prompt (a question, a term to define, a scenario, or an" +
          " instruction like \"compare X and Y\") and \"back\" is the concise answer. Vary the cards" +
          " across types: plain definitions, why-it-matters explanations, concrete real-world" +
          " examples, comparisons between related concepts, and short practice questions that make" +
          " the student apply the idea — never sentences copied straight from a textbook. Keep each" +
          " side to 1-3 sentences so cards work for active recall. Default to 10 cards if no count" +
          " is specified.",
      ].join(" ");
    case "quiz":
      return [
        base,
        `Create a practice quiz on the given topic or material.${detailHint}`,
        "Number each question. Use multiple choice by default unless told otherwise. After all" +
          " questions, include a clearly labeled \"Answer key\" section with the correct answer and a" +
          " one-line rationale for each. Default to 5 questions of medium difficulty if unspecified.",
      ].join(" ");
    case "homework":
      return [
        base,
        "Solve the given homework question with a full, step-by-step worked solution — not just the" +
          " final answer.",
        "Explain the reasoning at each step the way a patient tutor would, so the student could redo a" +
          " similar problem on their own afterward. State the final answer clearly at the end.",
      ].join(" ");
    case "planner":
      return [
        base,
        `Build a realistic, day-by-day study plan for the given subjects/topics.${detailHint}`,
        "Balance coverage across all listed subjects, prioritize weaker/harder topics earlier, and" +
          " include periodic review and at least one practice-test day near the end if a deadline is" +
          " given. Format as a clear day-by-day (or week-by-week) breakdown.",
      ].join(" ");
    case "summarize":
      return [
        base,
        "Summarize the given notes or text into a tight, high-signal summary — the key ideas and facts" +
          " only, no filler or repetition.",
        "Use a short bullet list of the main points, ordered by importance. Preserve any critical" +
          " numbers, names, dates, or formulas exactly.",
      ].join(" ");
    case "exam":
      return [
        base,
        `Simulate exam-style practice questions for the given subject/material.${detailHint}`,
        "Match the tone and difficulty of a real exam for the specified exam type where given. Number" +
          " each question, then provide a full \"Answer key\" section afterward with the correct answer" +
          " and a brief rationale for each — the kind of explanation that helps the student understand" +
          " *why*, not just what.",
      ].join(" ");
  }
}

const CHAT_SYSTEM_PROMPT = [
  "You are StudyForge's AI Study Chat, a focused, encouraging tutor embedded in NexPrompt.",
  "Help the student with anything study-related: explaining concepts, working through homework,",
  "quizzing them, planning study time, or just thinking out loud about a subject.",
  "Be clear and direct — this is a working study session, not an essay. Break things down step by",
  "step when explaining, and check understanding with a quick follow-up question when it helps.",
  "When you're not sure what subject or level the student means, make a reasonable assumption and",
  "say so briefly rather than stalling on a clarifying question.",
].join(" ");

type GroqCallResult =
  | { ok: true; output: string }
  | { ok: false; exhausted: true } // 401/403/429 — try the next key
  | { ok: false; exhausted: false; status: number }; // other failure — stop retrying

async function callGroq(
  apiKey: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { json?: boolean } = {}
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
      temperature: 0.4,
      messages,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("StudyForge Groq API error", response.status, detail);
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

/** Parses the model's `{"cards":[{"front":"...","back":"..."}]}` JSON
 *  response into a validated array, stripping stray code fences some
 *  models add despite instructions. Returns null (never throws) if the
 *  shape doesn't match, so the caller can fall back cleanly. */
function parseFlashcardsJson(raw: string): { front: string; back: string }[] | null {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).cards)
      ? (parsed as Record<string, unknown>).cards
      : null;
  if (!Array.isArray(list)) return null;

  const cards: { front: string; back: string }[] = [];
  for (const entry of list) {
    if (
      entry &&
      typeof entry === "object" &&
      typeof (entry as Record<string, unknown>).front === "string" &&
      typeof (entry as Record<string, unknown>).back === "string"
    ) {
      const front = (entry as Record<string, string>).front.trim();
      const back = (entry as Record<string, string>).back.trim();
      if (front && back) cards.push({ front, back });
    }
  }
  return cards.length > 0 ? cards : null;
}

type RequestBody =
  | {
      mode: "tool";
      tool?: StudyForgeTool;
      input?: string;
      detail?: string;
    }
  | {
      mode: "chat";
      messages?: ChatMessage[];
    };

export async function POST(request: Request) {
  if (!isStudyForgeConfigured()) {
    return NextResponse.json({ error: "StudyForge provider not configured" }, { status: 501 });
  }

  const settings = await getSystemSettings();
  if (settings.maintenanceMode) {
    return NextResponse.json({ error: "AI features are temporarily in maintenance mode" }, { status: 503 });
  }
  if (!settings.studyforgeEnabled) {
    return NextResponse.json({ error: "StudyForge is currently disabled" }, { status: 403 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let messages: { role: "system" | "user" | "assistant"; content: string }[];
  let eventType: EventType;
  let isFlashcards = false;

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
    const system = toolSystemPrompt(tool, body.detail?.trim() ?? "");
    messages = [
      { role: "system", content: system },
      { role: "user", content: input },
    ];
    eventType = TOOL_EVENT_TYPES[tool];
    isFlashcards = tool === "flashcards";
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
    eventType = "studyforge.chat";
  } else {
    return NextResponse.json({ error: "Invalid or missing mode" }, { status: 400 });
  }

  const session = await getAppSessionOrNull();
  const keyLabels = getStudyForgeKeyLabels();

  try {
    const keys = getStudyForgeApiKeys();
    // Start from the last key that worked, wrapping around, so a healthy
    // key found mid-list doesn't get bypassed every request.
    const startIndex = getLastGoodKeyIndex("studyforge");
    const order = keys.map((_, i) => (startIndex + i) % keys.length);

    let lastFailure: { exhausted: boolean; status?: number } | null = null;

    for (const i of order) {
      const result = await callGroq(keys[i], messages, { json: isFlashcards });
      await recordGroqUsage({ pool: "studyforge", keyLabel: keyLabels[i] ?? `key-${i + 1}`, success: result.ok });

      if (result.ok) {
        setLastGoodKeyIndex("studyforge", i); // remember this key for next time
        await recordEvent({ userLabel: session?.email, eventType, success: true });
        if (isFlashcards) {
          const cards = parseFlashcardsJson(result.output);
          if (cards) {
            return NextResponse.json({ cards });
          }
          // Model didn't return valid JSON — treat as a provider failure so
          // the client falls back to its local structured deck instead of
          // rendering broken/unparseable output.
          return NextResponse.json({ error: "StudyForge could not parse a flashcard deck" }, { status: 502 });
        }
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
      metadata: { source: "studyforge", reason: lastFailure?.exhausted ? "rate_limited" : "provider_error" },
    });

    if (lastFailure && !lastFailure.exhausted) {
      return NextResponse.json({ error: "StudyForge provider request failed" }, { status: lastFailure.status ?? 502 });
    }
    // Every configured key was exhausted (rate-limited or invalid).
    return NextResponse.json(
      { error: "All configured StudyForge provider keys are currently rate-limited or invalid" },
      { status: 429 }
    );
  } catch (err) {
    console.error("StudyForge Groq API request failed", err);
    await recordEvent({
      userLabel: session?.email,
      eventType: "ai.error",
      success: false,
      metadata: { source: "studyforge", reason: "exception" },
    });
    return NextResponse.json({ error: "StudyForge provider request failed" }, { status: 502 });
  }
}
