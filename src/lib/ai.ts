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
