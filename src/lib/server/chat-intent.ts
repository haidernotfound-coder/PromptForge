/**
 * Unified AI Chat — intent detection (Phase 2).
 *
 * Deliberately dumb and cheap: a handful of regexes over the user's latest
 * message, no extra model call spent just to classify. It only ever
 * *suggests* a delegate; `route.ts` always falls back to the normal
 * general-purpose reply if the suggested Forge is unavailable, disabled, or
 * fails, so a wrong guess here never breaks the chat.
 */

export type ChatIntent =
  | { kind: "code" }
  | { kind: "study" }
  | { kind: "ppt"; topic: string }
  | { kind: "promptforge"; action: "improve" | "rewrite" | "expand" | "shorten" | "critique"; input: string }
  | { kind: "normal" };

const CODE_RE =
  /\b(debug|fix (my|this|the) (code|bug|script|function)|write (me )?(a |some )?(function|script|program|code)|refactor|unit tests?|code review|review (my|this) code|optimi[sz]e (my|this) code|convert (my|this) code|explain (this|my) code|programming (help|question)|stack ?trace|syntax error|regex for|algorithm (for|to)|leetcode)\b/i;

const STUDY_RE =
  /\b(quiz me|make (me )?(a |some )?(quiz|flashcards?)|study (guide|notes|plan|session)|flash ?cards?|summarize (this |that )?for (studying|the exam|an exam)|explain like i'?m (five|learning)|test me on|help me (study|learn|revise)|create (a )?study guide)\b/i;

const PPT_RE =
  /\b(slide ?deck|(power ?point|ppt|pptx)( presentation)?|build (me )?(a )?deck|make (me )?(a )?(slide ?deck|presentation)|create (a )?presentation)\b/i;

const PROMPTFORGE_RE =
  /\b(improve|rewrite|expand|shorten|critique)\s+(this|my|the following)\s+prompt\b/i;

function stripLeadIn(message: string, triggerRe: RegExp): string {
  return message.replace(triggerRe, "").replace(/^[\s:,-]+/, "").trim();
}

export function detectChatIntent(message: string): ChatIntent {
  const trimmed = message.trim();
  if (!trimmed) return { kind: "normal" };

  const promptMatch = trimmed.match(PROMPTFORGE_RE);
  if (promptMatch) {
    const action = promptMatch[1].toLowerCase() as "improve" | "rewrite" | "expand" | "shorten" | "critique";
    const input = stripLeadIn(trimmed, PROMPTFORGE_RE) || trimmed;
    return { kind: "promptforge", action, input };
  }

  // A fenced code block in the message is as strong a signal as any keyword.
  if (CODE_RE.test(trimmed) || /```/.test(trimmed)) {
    return { kind: "code" };
  }

  if (STUDY_RE.test(trimmed)) {
    return { kind: "study" };
  }

  if (PPT_RE.test(trimmed)) {
    const topic = stripLeadIn(trimmed, PPT_RE) || trimmed;
    return { kind: "ppt", topic };
  }

  return { kind: "normal" };
}
