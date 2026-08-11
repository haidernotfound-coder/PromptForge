/**
 * StudyForge — shared module
 * ---------------------------
 * Talks to `/api/studyforge` (its own 10-key Groq pool — see
 * `getStudyForgeApiKeys` in `lib/supabase/config.ts`), fully independent of
 * `lib/ai.ts`, `lib/forge-ai.ts`, and `lib/codeforge.ts`. Mirrors all three
 * modules' "just works with zero setup" shape — if StudyForge's keys
 * aren't configured (or a request fails), tool calls and chat replies fall
 * back to a local heuristic instead of erroring out, so every page is
 * usable before any key is set.
 *
 * Covers all 9 StudyForge features: the 8 one-shot tools (Explain
 * Concepts, Notes Generator, Flashcards, Quiz Generator, Homework Helper,
 * Study Planner, Notes Summarizer, Exam Practice) plus the multi-turn AI
 * Study Chat.
 */

export type StudyForgeTool =
  | "explain"
  | "notes"
  | "flashcards"
  | "quiz"
  | "homework"
  | "planner"
  | "summarize"
  | "exam";

export interface StudyForgeToolMeta {
  id: StudyForgeTool;
  label: string;
  description: string;
  inputLabel: string;
  inputPlaceholder: string;
  needsDetail: boolean;
  detailLabel: string;
  detailPlaceholder: string;
  href: string;
}

export const STUDYFORGE_TOOLS: StudyForgeToolMeta[] = [
  {
    id: "explain",
    label: "Explain Concepts",
    description: "Get a clear, plain-language walkthrough of any topic or idea.",
    inputLabel: "Concept or topic",
    inputPlaceholder: "e.g. Explain how photosynthesis works.",
    needsDetail: true,
    detailLabel: "Level (optional)",
    detailPlaceholder: "e.g. middle school, high school, college intro",
    href: "/studyforge/explain",
  },
  {
    id: "notes",
    label: "Notes Generator",
    description: "Turn a topic or reading into clean, structured study notes.",
    inputLabel: "Topic or reading",
    inputPlaceholder: "Paste a topic, chapter title, or reading material to take notes on…",
    needsDetail: true,
    detailLabel: "Format (optional)",
    detailPlaceholder: "e.g. bullet points, Cornell notes, outline",
    href: "/studyforge/notes",
  },
  {
    id: "flashcards",
    label: "Flashcards",
    description: "Generate a deck of question/answer flashcards on any subject.",
    inputLabel: "Topic or material",
    inputPlaceholder: "Paste notes, or describe the subject you want flashcards for…",
    needsDetail: true,
    detailLabel: "Class / chapter / count (optional)",
    detailPlaceholder: "e.g. Class 9, Chapter 3 — Force and Laws of Motion, 10 cards",
    href: "/studyforge/flashcards",
  },
  {
    id: "quiz",
    label: "Quiz Generator",
    description: "Create a practice quiz with an answer key on any topic.",
    inputLabel: "Topic or material",
    inputPlaceholder: "Paste notes, or describe the subject you want a quiz on…",
    needsDetail: true,
    detailLabel: "Difficulty / question count (optional)",
    detailPlaceholder: "e.g. 5 medium-difficulty multiple choice questions",
    href: "/studyforge/quiz",
  },
  {
    id: "homework",
    label: "Homework Helper",
    description: "Get a worked, step-by-step walkthrough of a homework problem.",
    inputLabel: "Homework question",
    inputPlaceholder: "Paste the exact question or problem you're stuck on…",
    needsDetail: false,
    detailLabel: "",
    detailPlaceholder: "",
    href: "/studyforge/homework",
  },
  {
    id: "planner",
    label: "Study Planner",
    description: "Get a day-by-day study plan built around your subjects and timeline.",
    inputLabel: "Subjects / topics to cover",
    inputPlaceholder: "e.g. Biology chapters 4-7, Algebra II unit 3, US History essay prep",
    needsDetail: true,
    detailLabel: "Timeframe (optional)",
    detailPlaceholder: "e.g. exam in 2 weeks, 1 hour per day, weekends only",
    href: "/studyforge/planner",
  },
  {
    id: "summarize",
    label: "Notes Summarizer",
    description: "Condense long notes or reading into a tight, high-signal summary.",
    inputLabel: "Notes or text to summarize",
    inputPlaceholder: "Paste the notes or reading you want condensed…",
    needsDetail: false,
    detailLabel: "",
    detailPlaceholder: "",
    href: "/studyforge/summarize",
  },
  {
    id: "exam",
    label: "Exam Practice",
    description: "Simulate exam-style questions with a full answer key and rationale.",
    inputLabel: "Subject / material to be examined on",
    inputPlaceholder: "Paste notes, or describe the subject and exam type…",
    needsDetail: true,
    detailLabel: "Exam type / focus (optional)",
    detailPlaceholder: "e.g. AP Bio unit 3 test, SAT-style reading passage",
    href: "/studyforge/exam",
  },
];

export function studyForgeToolMeta(tool: StudyForgeTool): StudyForgeToolMeta {
  const meta = STUDYFORGE_TOOLS.find((t) => t.id === tool);
  if (!meta) throw new Error(`Unknown StudyForge tool: ${tool}`);
  return meta;
}

export interface StudyForgeToolResult {
  output: string;
  remote: boolean;
}

export interface RunToolOptions {
  detail?: string;
  /** Up to 10 image data URLs (data:image/...;base64,...) for Groq's vision
   *  model to read and base the result on. */
  images?: string[];
}

/** Runs a StudyForge tool. Tries the real provider first (POST
 *  /api/studyforge, which uses the server-only STUDYFORGE_GROQ_API_KEY_1..10
 *  pool); if it isn't configured or the request fails, falls back to a
 *  local heuristic so every tool page keeps working with zero setup. */
export async function runStudyForgeTool(
  tool: StudyForgeTool,
  input: string,
  opts: RunToolOptions = {}
): Promise<StudyForgeToolResult> {
  if (!input.trim() && !(opts.images && opts.images.length > 0)) {
    return { output: "", remote: false };
  }

  try {
    const res = await fetch("/api/studyforge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "tool",
        tool,
        input,
        detail: opts.detail,
        images: opts.images,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.output === "string" && data.output.trim()) {
        return { output: data.output, remote: true };
      }
    }
  } catch {
    // fall through to local heuristic
  }

  return { output: localToolReply(tool, input, opts), remote: false };
}

/** Zero-setup fallback so every tool page is usable before
 *  STUDYFORGE_GROQ_API_KEY_* is configured — deliberately simple/heuristic,
 *  same reasoning as lib/codeforge.ts's local tool replies. */
function localToolReply(tool: StudyForgeTool, input: string, opts: RunToolOptions): string {
  const notice = "StudyForge is running in demo mode (no STUDYFORGE_GROQ_API_KEY configured yet).";
  const topic = firstLine(input);
  const detail = opts.detail?.trim();

  switch (tool) {
    case "explain":
      return [
        notice,
        "",
        `Once a real key is configured, StudyForge will explain "${topic}" clearly and step by step` +
          (detail ? `, at a ${detail} level.` : "."),
        "For now: try breaking the topic into its core parts, define any unfamiliar terms first, then" +
          " connect them with a simple real-world example.",
      ].join("\n");
    case "notes":
      return [
        notice,
        "",
        `# Notes: ${topic}`,
        "- Key point 1 — (a real generated note will appear here once a key is configured)",
        "- Key point 2",
        "- Key point 3",
        detail ? `\n_Format requested: ${detail}_` : "",
      ]
        .filter(Boolean)
        .join("\n");
    case "flashcards":
      return [
        notice,
        "",
        `Deck: ${topic}`,
        "",
        "Q1: (sample question) — A1: (sample answer)",
        "Q2: (sample question) — A2: (sample answer)",
        "Q3: (sample question) — A3: (sample answer)",
        detail ? `\nRequested card count: ${detail}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    case "quiz":
      return [
        notice,
        "",
        `Practice quiz: ${topic}`,
        "",
        "1. (sample question)",
        "   a) option  b) option  c) option  d) option",
        "",
        "Answer key: 1) — set a real key for genuine, subject-accurate questions.",
        detail ? `\nRequested: ${detail}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    case "homework":
      return [
        notice,
        "",
        `Question: ${topic}`,
        "",
        "A demo-mode pass can't solve this for real. Once a key is configured, Homework Helper will" +
          " walk through the problem step by step and explain the reasoning at each step, not just the" +
          " final answer.",
      ].join("\n");
    case "planner":
      return [
        notice,
        "",
        `Study plan for: ${topic}`,
        "",
        "Day 1: Review core material and identify weak spots.",
        "Day 2: Active recall practice (flashcards/quiz) on weak spots.",
        "Day 3: Full review + practice exam.",
        detail ? `\nTimeframe requested: ${detail}` : "",
        "\nSet a real key for a genuine plan tailored to your subjects and timeline.",
      ]
        .filter(Boolean)
        .join("\n");
    case "summarize": {
      const lines = input.trim().split("\n").length;
      return [
        notice,
        "",
        `This text is ${lines} line${lines === 1 ? "" : "s"} long. In demo mode, StudyForge can't` +
          " produce a real summary — set STUDYFORGE_GROQ_API_KEY_1 (or up to _10) to get a genuine," +
          " tightly condensed summary of the key ideas.",
      ].join("\n");
    }
    case "exam":
      return [
        notice,
        "",
        `Exam practice: ${topic}`,
        "",
        "Q1. (sample exam-style question)",
        "Model answer: (a real generated answer + rationale will appear here once a key is configured)",
        detail ? `\nExam type / focus requested: ${detail}` : "",
      ]
        .filter(Boolean)
        .join("\n");
  }
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface StudyForgeFlashcardsResult {
  cards: Flashcard[];
  remote: boolean;
}

/** Runs the Flashcards tool and returns a structured deck (never markdown/
 *  numbered text) — the API asks the model for strict JSON and this parses
 *  it; if StudyForge's keys aren't configured, the request fails, or the
 *  response can't be parsed as a deck, falls back to a locally generated
 *  structured deck so the flashcard UI always has real card objects to
 *  render. */
export async function runStudyForgeFlashcards(
  input: string,
  opts: RunToolOptions = {}
): Promise<StudyForgeFlashcardsResult> {
  if (!input.trim() && !(opts.images && opts.images.length > 0)) {
    return { cards: [], remote: false };
  }

  try {
    const res = await fetch("/api/studyforge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "tool",
        tool: "flashcards",
        input,
        detail: opts.detail,
        images: opts.images,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const cards = parseFlashcards(data.cards);
      if (cards.length > 0) {
        return { cards, remote: true };
      }
    }
  } catch {
    // fall through to local heuristic
  }

  return { cards: localFlashcards(input, opts), remote: false };
}

function parseFlashcards(raw: unknown): Flashcard[] {
  if (!Array.isArray(raw)) return [];
  const cards: Flashcard[] = [];
  for (const entry of raw) {
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
  return cards;
}

/** Zero-setup fallback deck — structured, not copied sentences, so the
 *  interactive flashcard UI works before any Groq key is configured. Mixes
 *  a definition, an example, a comparison, and a practice-question card so
 *  the shape matches what the real model is asked to produce. */
function localFlashcards(input: string, opts: RunToolOptions): Flashcard[] {
  const topic = firstLine(input);
  // Pull a count out of anywhere in the detail string (e.g. "Class 9, 10
  // cards") instead of requiring the whole field to be a bare number.
  const countMatch = (opts.detail ?? "").match(/\d+/);
  const count = countMatch ? Number.parseInt(countMatch[0], 10) : NaN;
  const base: Flashcard[] = [
    { front: `Define: ${topic}`, back: "(A real, concise definition will appear here once a StudyForge key is configured.)" },
    { front: `Why does "${topic}" matter?`, back: "(A real explanation of its significance will appear here once a key is configured.)" },
    { front: `Give a real-world example of ${topic}.`, back: "(A concrete example will appear here once a key is configured.)" },
    { front: `How does ${topic} compare to a related concept?`, back: "(A real comparison will appear here once a key is configured.)" },
    { front: `Practice: apply ${topic} to a new scenario.`, back: "(A real practice question and answer will appear here once a key is configured.)" },
  ];
  const target = Number.isFinite(count) && count > 0 ? Math.min(count, 30) : base.length;
  const cards: Flashcard[] = [];
  for (let i = 0; i < target; i++) cards.push(base[i % base.length]);
  return cards;
}

function firstLine(text: string): string {
  const line = text.trim().split("\n")[0] ?? "";
  return line.length > 80 ? `${line.slice(0, 80)}…` : line;
}

// --- AI Study Chat -----------------------------------------------------

import { buildAttachmentPayload, type ChatAttachment } from "@/lib/attachments";

export interface StudyForgeChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  attachments?: { name: string; size: number; kind: string }[];
}

function id(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const CHAT_STORAGE_KEY = "nexprompt:studyforge:chat";

/** Loads the saved AI Study Chat conversation. Returns [] on the server,
 *  on first load, or if storage is unavailable/corrupt. Chat history is
 *  local to this browser, same reasoning as CodeForge's AI Coding Chat —
 *  it's chat scratch space, not synced workspace data. */
export function loadStudyForgeChat(): StudyForgeChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is StudyForgeChatMessage =>
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

export function saveStudyForgeChat(messages: StudyForgeChatMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Storage unavailable (private browsing, quota) — history just won't persist.
  }
}

export function clearStudyForgeChat(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CHAT_STORAGE_KEY);
  } catch {
    // no-op
  }
}

export function makeStudyForgeMessage(
  role: StudyForgeChatMessage["role"],
  content: string,
  attachments?: ChatAttachment[]
): StudyForgeChatMessage {
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

/** Sends the full conversation to StudyForge's own endpoint and returns the
 *  assistant's reply text. Falls back to a local heuristic reply if the
 *  provider isn't configured or the request fails. */
export async function sendStudyForgeChatMessage(
  history: StudyForgeChatMessage[],
  attachments: ChatAttachment[] = []
): Promise<string> {
  try {
    const { contextBlocks, images, documents } = buildAttachmentPayload(attachments);
    const res = await fetch("/api/studyforge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "chat",
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
  return localChatReply(history);
}

function localChatReply(history: StudyForgeChatMessage[]): string {
  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const lower = lastUser.toLowerCase();

  let focus = "the details of what you just asked";
  if (lower.includes("flashcard")) focus = "the Flashcards tool";
  else if (lower.includes("quiz") || lower.includes("test me")) focus = "the Quiz Generator tool";
  else if (lower.includes("homework") || lower.includes("solve") || lower.includes("problem"))
    focus = "the Homework Helper tool for a real step-by-step solution";
  else if (lower.includes("plan") || lower.includes("schedule")) focus = "the Study Planner tool";
  else if (lower.includes("summar")) focus = "the Notes Summarizer tool";
  else if (lower.includes("exam") || lower.includes("practice test")) focus = "the Exam Practice tool";
  else if (lower.includes("note")) focus = "the Notes Generator tool";
  else if (lower.includes("explain") || lower.includes("what is") || lower.includes("how does"))
    focus = "the Explain Concepts tool";

  return [
    "AI Study Chat is running in demo mode (no STUDYFORGE_GROQ_API_KEY configured yet), so this is a heuristic reply rather than a real model response.",
    `For ${focus}, you'll get a much more useful result from one of the dedicated tools in the StudyForge sidebar — each is tuned specifically for that job.`,
    "Once real keys are configured (STUDYFORGE_GROQ_API_KEY_1 through _10 supported for automatic fallback), this chat becomes a full study assistant.",
  ].join(" ");
}
