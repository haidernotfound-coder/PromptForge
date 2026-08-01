/**
 * Phase 4 — AI engine (demo mode)
 * --------------------------------
 * There's still no backend/provider wiring (that's Phase 7). This module
 * simulates the four core AI actions — improve, rewrite, expand, shorten —
 * with local, deterministic-ish text transforms and a small artificial
 * delay, so the UI (loading states, diff preview, accept/discard, history)
 * is fully real. Swapping this for a real provider call later is a matter
 * of replacing the body of `runAiAction`, not the UI that calls it.
 */

export type AiActionType = "improve" | "rewrite" | "expand" | "shorten";

export interface PromptCritique {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  fixedPrompt: string;
}

export type RewriteTone = "professional" | "casual" | "confident" | "friendly" | "concise";

export interface AiActionOptions {
  tone?: RewriteTone;
}

export interface AiActionResult {
  action: AiActionType;
  input: string;
  output: string;
  summary: string;
}

const ACTION_LABELS: Record<AiActionType, string> = {
  improve: "Improved",
  rewrite: "Rewritten",
  expand: "Expanded",
  shorten: "Shortened",
};

export function aiActionLabel(action: AiActionType, opts?: AiActionOptions): string {
  if (action === "rewrite" && opts?.tone) {
    return `Rewritten (${TONE_LABELS[opts.tone]})`;
  }
  return ACTION_LABELS[action];
}

const TONE_LABELS: Record<RewriteTone, string> = {
  professional: "professional",
  casual: "casual",
  confident: "confident",
  friendly: "friendly",
  concise: "concise",
};

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

// Preserve {{variables}} exactly — never let a transform mangle a placeholder.
function withVariablesLocked<T>(body: string, transform: (placeholderized: string) => T): T {
  const found: string[] = [];
  const placeholderized = body.replace(/\{\{\s*[\w.-]+\s*\}\}/g, (m) => {
    found.push(m);
    return `\u0000${found.length - 1}\u0000`;
  });
  const result = transform(placeholderized);
  if (typeof result === "string") {
    return result.replace(/\u0000(\d+)\u0000/g, (_, i) => found[Number(i)]) as unknown as T;
  }
  return result;
}

function doImprove(body: string): string {
  return withVariablesLocked(body, (text) => {
    const lines = text.split("\n");
    const improved = lines.map((line) => {
      let l = line.replace(/\s+/g, " ").trim();
      if (!l) return "";
      // Tighten weak openers.
      l = l.replace(/^(please\s+)?(try to|kind of|sort of)\s+/i, "");
      l = l.replace(/\bin order to\b/gi, "to");
      l = l.replace(/\bvery\s+/gi, "");
      l = l.replace(/\bthing(s)?\b/gi, "output$1");
      if (!/[.!?:]$/.test(l) && !/^[-*#>]/.test(l)) l += ".";
      return l.charAt(0).toUpperCase() + l.slice(1);
    });
    return improved.join("\n");
  });
}

function doRewrite(body: string, tone: RewriteTone = "professional"): string {
  return withVariablesLocked(body, (text) => {
    const parts = sentences(text.replace(/\n/g, " ¶"));
    const openers: Record<RewriteTone, string[]> = {
      professional: ["Please", "Kindly", "As requested,"],
      casual: ["Hey, so", "Quick note —", "Basically,"],
      confident: ["Here's the plan:", "Do this:", "Make it happen:"],
      friendly: ["Happy to help —", "Here's the idea:", "Let's do this:"],
      concise: [],
    };
    const opener = openers[tone][0];
    const rewritten = parts.map((s, i) => {
      let out = s.trim();
      if (tone === "concise") {
        out = out.replace(/\b(please|kindly|just|really|basically|actually)\b/gi, "").replace(/\s+/g, " ").trim();
      }
      if (i === 0 && opener && !out.startsWith(opener)) {
        out = `${opener} ${out.charAt(0).toLowerCase()}${out.slice(1)}`;
      }
      return out;
    });
    return rewritten.join(" ").replace(/\s¶\s/g, "\n");
  });
}

function doExpand(body: string): string {
  return withVariablesLocked(body, (text) => {
    const lines = text.split("\n").filter(Boolean);
    const additions = [
      "Be specific and reference concrete details wherever possible.",
      "Explain your reasoning briefly before giving the final answer.",
      "If information is missing or ambiguous, state your assumptions explicitly.",
    ];
    return [...lines, "", ...additions].join("\n");
  });
}

function doShorten(body: string): string {
  return withVariablesLocked(body, (text) => {
    const parts = sentences(text.replace(/\n/g, " ¶"));
    const keep = Math.max(1, Math.ceil(parts.length * 0.6));
    const trimmed = parts.slice(0, keep).map((s) =>
      s
        .replace(/\b(please|kindly|just|really|basically|actually|in order to)\b/gi, (m) =>
          m.toLowerCase() === "in order to" ? "to" : ""
        )
        .replace(/\s+/g, " ")
        .trim()
    );
    return trimmed.join(" ").replace(/\s¶\s/g, "\n");
  });
}

/**
 * Runs an AI action. Tries the real provider first (POST /api/ai, which
 * uses a server-only GROQ_API_KEY — see that route for details); if
 * the provider isn't configured or the request fails for any reason, falls
 * back to the local simulation below so the AI panel keeps working with
 * zero setup, exactly like Phases 4–6.
 */
export async function runAiAction(
  action: AiActionType,
  input: string,
  opts: AiActionOptions = {}
): Promise<AiActionResult> {
  if (!input.trim()) {
    return { action, input, output: input, summary: "Nothing to change — the prompt is empty." };
  }

  const before = wordCount(input);

  const remote = await tryRemoteAiAction(action, input, opts);
  if (remote) {
    const after = wordCount(remote);
    const delta = after - before;
    const deltaText =
      delta === 0 ? "word count unchanged" : `${delta > 0 ? "+" : ""}${delta} word${Math.abs(delta) === 1 ? "" : "s"}`;
    return {
      action,
      input,
      output: remote,
      summary: `${aiActionLabel(action, opts)} · ${before} → ${after} words (${deltaText})`,
    };
  }

  return runLocalAiAction(action, input, opts, before);
}

async function tryRemoteAiAction(
  action: AiActionType,
  input: string,
  opts: AiActionOptions
): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, input, tone: opts.tone }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.output === "string" && data.output.trim() ? data.output : null;
  } catch {
    return null;
  }
}

/** Simulates an AI call: small artificial delay + local transform. Used
 *  whenever no real provider is configured. */
async function runLocalAiAction(
  action: AiActionType,
  input: string,
  opts: AiActionOptions,
  before: number
): Promise<AiActionResult> {
  await new Promise((r) => setTimeout(r, 550 + Math.random() * 450));

  let output: string;
  switch (action) {
    case "improve":
      output = doImprove(input);
      break;
    case "rewrite":
      output = doRewrite(input, opts.tone);
      break;
    case "expand":
      output = doExpand(input);
      break;
    case "shorten":
      output = doShorten(input);
      break;
  }

  const after = wordCount(output);
  const delta = after - before;
  const deltaText =
    delta === 0 ? "word count unchanged" : `${delta > 0 ? "+" : ""}${delta} word${Math.abs(delta) === 1 ? "" : "s"}`;

  return {
    action,
    input,
    output,
    summary: `${aiActionLabel(action, opts)} · ${before} → ${after} words (${deltaText})`,
  };
}

/**
 * Phase 9 — AI Prompt Critic
 * --------------------------
 * Scores a prompt's quality (0-100), lists strengths/weaknesses, gives
 * actionable suggestions, and produces a `fixedPrompt` that applies those
 * suggestions automatically. Tries the real provider first (POST /api/ai
 * with action "critique"); falls back to a deterministic local heuristic
 * so the feature works with zero setup, same pattern as `runAiAction`.
 */
export async function critiquePrompt(input: string): Promise<PromptCritique> {
  if (!input.trim()) {
    return {
      score: 0,
      strengths: [],
      weaknesses: ["The prompt is empty."],
      suggestions: ["Write a prompt before requesting a critique."],
      fixedPrompt: input,
    };
  }

  const remote = await tryRemoteCritique(input);
  if (remote) return remote;

  return localCritique(input);
}

async function tryRemoteCritique(input: string): Promise<PromptCritique | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "critique", input }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return parseCritiqueJson(typeof data.output === "string" ? data.output : "");
  } catch {
    return null;
  }
}

/** Parses (and validates the shape of) a JSON critique returned by the
 *  model. Returns null on any malformed/missing field so the caller can
 *  fall back to the local heuristic instead of showing broken data. */
function parseCritiqueJson(raw: string): PromptCritique | null {
  if (!raw.trim()) return null;
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try {
    const parsed = JSON.parse(cleaned) as Partial<PromptCritique>;
    const score = typeof parsed.score === "number" ? Math.max(0, Math.min(100, Math.round(parsed.score))) : null;
    const strengths = Array.isArray(parsed.strengths) ? parsed.strengths.filter((s) => typeof s === "string") : null;
    const weaknesses = Array.isArray(parsed.weaknesses) ? parsed.weaknesses.filter((s) => typeof s === "string") : null;
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.filter((s) => typeof s === "string") : null;
    const fixedPrompt = typeof parsed.fixedPrompt === "string" && parsed.fixedPrompt.trim() ? parsed.fixedPrompt : null;
    if (score === null || !strengths || !weaknesses || !suggestions || !fixedPrompt) return null;
    return { score, strengths, weaknesses, suggestions, fixedPrompt };
  } catch {
    return null;
  }
}

/** Counts unique {{variable}} placeholders. Duplicated (rather than
 *  imported) from editor-toolbar.tsx's `extractVariables` so this
 *  server-safe module has no dependency on a "use client" file. */
function countVariables(body: string): number {
  const matches = body.match(/\{\{\s*[\w.-]+\s*\}\}/g) ?? [];
  const seen = new Set<string>();
  for (const m of matches) seen.add(m.replace(/[{}]/g, "").trim());
  return seen.size;
}

const VAGUE_WORDS = /\b(thing|things|stuff|something|somehow|maybe|etc\.?|whatever|good|nice|better)\b/gi;
const ROLE_HINT = /\b(you are|act as|as an?|your role is)\b/i;
const FORMAT_HINT = /\b(format|json|markdown|bullet|table|numbered list|output should)\b/i;
const EXAMPLE_HINT = /\b(example|e\.g\.|for instance|for example)\b/i;
const STEPS_HINT = /\b(step[- ]by[- ]step|first,|then,|finally,|steps?:)\b/i;
const TASK_VERB = /^(write|generate|create|summarize|summarise|explain|analyze|analyse|translate|list|draft|compose|design|build|review|answer|describe|classify|extract|convert|plan|outline)/i;

/** Deterministic local critique so the feature works with zero setup,
 *  mirroring the local-transform fallback pattern used above. */
function localCritique(input: string): PromptCritique {
  const trimmed = input.trim();
  const words = wordCount(trimmed);
  const firstWord = trimmed.split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, "") ?? "";

  const hasRole = ROLE_HINT.test(trimmed);
  const hasFormat = FORMAT_HINT.test(trimmed);
  const hasExamples = EXAMPLE_HINT.test(trimmed);
  const hasSteps = STEPS_HINT.test(trimmed);
  const hasClearTask = TASK_VERB.test(firstWord);
  const vagueMatches = trimmed.match(VAGUE_WORDS) ?? [];
  const endsWithPunctuation = /[.!?]$/.test(trimmed);
  const variableCount = countVariables(trimmed);

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const suggestions: string[] = [];
  let score = 50;

  if (words < 6) {
    score -= 20;
    weaknesses.push("The prompt is very short and likely under-specifies the task.");
    suggestions.push("Add more context: what the task is, who it's for, and what a good result looks like.");
  } else if (words > 250) {
    score -= 8;
    weaknesses.push("The prompt is quite long, which can bury the core instruction.");
    suggestions.push("Trim or restructure so the main instruction isn't lost in detail.");
  } else {
    score += 6;
    strengths.push("The prompt is a reasonable, focused length.");
  }

  if (hasClearTask) {
    score += 10;
    strengths.push("Opens with a clear action verb, so the task is unambiguous.");
  } else {
    score -= 10;
    weaknesses.push("It's not immediately clear what action is being requested.");
    suggestions.push("Start with a direct instruction verb, e.g. \"Write\", \"Summarize\", \"Explain\".");
  }

  if (hasRole) {
    score += 8;
    strengths.push("Establishes a role or persona for the model.");
  } else {
    suggestions.push("Consider framing a role for the model (e.g. \"You are an expert editor...\").");
  }

  if (hasFormat) {
    score += 8;
    strengths.push("Specifies the desired output format.");
  } else {
    score -= 6;
    weaknesses.push("No output format is specified.");
    suggestions.push("State the desired output format (bullet points, JSON, a table, etc.).");
  }

  if (hasSteps) {
    score += 6;
    strengths.push("Encourages step-by-step reasoning.");
  }

  if (hasExamples) {
    score += 6;
    strengths.push("Includes an example to anchor the expected output.");
  } else if (words > 15) {
    suggestions.push("Add a short example of the desired input/output to reduce ambiguity.");
  }

  if (vagueMatches.length > 0) {
    score -= Math.min(15, vagueMatches.length * 5);
    weaknesses.push(
      `Uses ${vagueMatches.length} vague word${vagueMatches.length === 1 ? "" : "s"} (e.g. "${vagueMatches[0]}") that weaken precision.`
    );
    suggestions.push("Replace vague words with specific, concrete language.");
  }

  if (!endsWithPunctuation) {
    score -= 3;
    weaknesses.push("Doesn't end with clear closing punctuation, which can read as unfinished.");
  }

  if (variableCount > 0) {
    strengths.push(`Uses ${variableCount} reusable {{variable}} placeholder${variableCount === 1 ? "" : "s"}.`);
  }

  if (strengths.length === 0) strengths.push("The prompt communicates a basic intent.");
  if (weaknesses.length === 0) weaknesses.push("No major issues found — just minor polish opportunities.");
  if (suggestions.length === 0) suggestions.push("Consider adding an explicit success criterion for the output.");

  score = Math.max(0, Math.min(100, Math.round(score)));

  const fixedPrompt = buildFixedPrompt(trimmed, { hasRole, hasFormat, hasSteps, words });

  return { score, strengths, weaknesses, suggestions, fixedPrompt };
}

/** Applies the local critique's suggestions to produce a corrected prompt:
 *  tightens wording (reusing `doImprove`) then appends any structural
 *  guidance the original prompt was missing. Variables stay locked. */
function buildFixedPrompt(
  body: string,
  gaps: { hasRole: boolean; hasFormat: boolean; hasSteps: boolean; words: number }
): string {
  return withVariablesLocked(doImprove(body), (text) => {
    const additions: string[] = [];
    if (!gaps.hasRole) {
      additions.push("You are a meticulous expert assistant working on this task.");
    }
    if (!gaps.hasFormat) {
      additions.push("Present the output in a clear, well-structured format.");
    }
    if (!gaps.hasSteps && gaps.words > 20) {
      additions.push("Think through the task step by step before giving the final answer.");
    }
    if (additions.length === 0) return text;
    return [text, "", ...additions].join("\n");
  });
}
