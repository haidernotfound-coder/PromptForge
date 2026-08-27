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
  | { kind: "file"; topic: string }
  | { kind: "search"; query: string }
  | { kind: "normal" };

const CODE_RE =
  /\b(debug|fix (my|this|the) (code|bug|script|function)|write (me )?(a |some )?(function|script|program|code)|refactor|unit tests?|code review|review (my|this) code|optimi[sz]e (my|this) code|convert (my|this) code|explain (this|my) code|programming (help|question)|stack ?trace|syntax error|regex for|algorithm (for|to)|leetcode)\b/i;

const STUDY_RE =
  /\b(quiz me|make (me )?(a |some )?(quiz|flashcards?)|study (guide|notes|plan|session)|flash ?cards?|summarize (this |that )?for (studying|the exam|an exam)|explain like i'?m (five|learning)|test me on|help me (study|learn|revise)|create (a )?study guide)\b/i;

// Broadened on purpose: the old version only matched a handful of rigid
// phrasings ("create a presentation", "make a slide deck", literal
// "ppt"/"pptx"/"powerpoint"), so ordinary requests like "give me a
// presentation on X", "I need a ppt about X", "presentation on X please",
// or "can you prepare a presentation on X" fell through to a plain-text
// reply instead of delegating to PPTForge. This now matches on either (a)
// a generation verb ("make/build/create/generate/design/prepare/give
// me/send me/i need/i want/whip up/put together/draft") followed by a
// presentation noun, or (b) the noun itself followed by a topic connector
// ("on/about/for/regarding/covering") or trailing "please" — which covers
// the noun-first phrasings the verb-first pattern above misses.
const PPT_VERB = "(make|build|create|generate|design|prepare|draft|whip up|put together|give me|send me|i need|i want)";
const PPT_NOUN = "(slide ?deck|power ?point( presentation)?|ppt|pptx|presentation|deck)";
const PPT_RE = new RegExp(
  `\\b(${PPT_VERB}\\s+(me\\s+)?(a\\s+|an\\s+|some\\s+)?${PPT_NOUN}` +
    `|${PPT_NOUN}\\s+(on|about|for|regarding|covering)\\b` +
    `|${PPT_NOUN}(\\s+(file|please))+\\b)`,
  "i"
);

const TOPIC_TRAIL_RE = /\s*\b(please|for me|now)\b[\s:,.\-]*$/i;

// Words that carry no topic content on their own — verbs, nouns, and
// courtesy words from PPT_RE itself plus stray punctuation. Used to decide
// whether what's left after extraction is an actual topic or just
// leftover scaffolding (e.g. "send me .pptx file" -> "send me ." has no
// real word in it at all).
const PPT_FILLER_WORDS = new Set([
  "a", "an", "some", "me", "please", "now", "file", "files", "deck",
  "slide", "slides", "ppt", "pptx", "presentation", "powerpoint",
  "power", "point", "it", "that", "this", "one", "for", "on", "about",
  "regarding", "covering", "make", "build", "create", "generate",
  "design", "prepare", "draft", "whip", "put", "together", "send",
  "give", "want", "need", "i", "you", "can", "could", "would",
]);

function isEmptyPptTopic(topic: string): boolean {
  const words = topic
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
  return words.length === 0 || words.every((w) => PPT_FILLER_WORDS.has(w));
}

/** Extracts the actual subject from a "make me a presentation on X" style
 *  message. Previously this just stripped the matched PPT_RE phrase and
 *  called it a day, which left leading connectors in place ("create a
 *  presentation on climate change" -> topic "on climate change") and, for
 *  scaffolding-only messages like "can you prepare a presentation on X",
 *  left the leading "can you" behind too (the trigger match only covers
 *  "prepare a presentation", not the "can you" before it or the "on X"
 *  after it). Preferring the text after the last topic connector
 *  ("on"/"about"/"for"/"regarding"/"covering") sidesteps both problems at
 *  once, since that's reliably where the real subject starts regardless of
 *  how much scaffolding surrounds it. */
function extractPptTopic(trimmed: string): string {
  const connectorMatch = trimmed.match(/\b(?:on|about|for|regarding|covering)\b\s+([\s\S]+)$/i);
  if (connectorMatch && !isEmptyPptTopic(connectorMatch[1])) {
    return connectorMatch[1].replace(TOPIC_TRAIL_RE, "").trim();
  }
  // No connector in the message (e.g. "build me a deck — Q3 roadmap") —
  // fall back to stripping the matched trigger phrase itself.
  return stripLeadIn(trimmed, PPT_RE)
    .replace(TOPIC_TRAIL_RE, "")
    .replace(/^[\s:,.\-—–]+/, "")
    .trim();
}

const PROMPTFORGE_RE =
  /\b(improve|rewrite|expand|shorten|critique)\s+(this|my|the following)\s+prompt\b/i;

// "Package/zip/bundle this up", "give me that as a file/zip/download",
// "save this as a file", "download this as code files" — anything asking
// for actual bytes back rather than another chat reply. Deliberately
// narrow (Phase 4 packages what's already in the conversation; it isn't a
// general-purpose "write me code" trigger — CODE_RE above already covers
// that and the reply itself can always be packaged after the fact).
const FILE_RE =
  /\b(zip (this|that|these|it)( up)?|package (this|that|these|it)( up)?|bundle (this|that|these)( up)?|(give|send) me (this|that|it) as a (file|download|zip)|save (this|that|it) as a (file|document|zip)|download (this|that|it) as( a)?( code)? files?|make (this|that|it) (a )?(downloadable|zip) file)\b/i;

// Explicit "go check the web" requests — current-events/lookup phrasing.
// Kept conservative on purpose: a false negative just answers from the
// model's own knowledge (status quo), while a false positive would silently
// spend a Gemini grounded-search call on an ordinary question.
const SEARCH_RE =
  /\b(search (the web|online|the internet) for|web search for|google|look up|what'?s the latest (on|news about)|latest news (on|about)|current(ly)? (happening|going on) (with|in)|what happened (with|to)|find (me )?(recent|current) (news|information) (on|about))\b/i;

function stripLeadIn(message: string, triggerRe: RegExp): string {
  return message.replace(triggerRe, "").replace(/^[\s:,-]+/, "").trim();
}

export function detectChatIntent(message: string, priorUserMessage?: string): ChatIntent {
  const trimmed = message.trim();
  if (!trimmed) return { kind: "normal" };

  const promptMatch = trimmed.match(PROMPTFORGE_RE);
  if (promptMatch) {
    const action = promptMatch[1].toLowerCase() as "improve" | "rewrite" | "expand" | "shorten" | "critique";
    const input = stripLeadIn(trimmed, PROMPTFORGE_RE) || trimmed;
    return { kind: "promptforge", action, input };
  }

  // Checked before PPT/code/study so "zip up that code" or "download that
  // slide deck as a file" packages what already exists instead of
  // re-generating it from scratch through a Forge.
  if (FILE_RE.test(trimmed)) {
    const topic = stripLeadIn(trimmed, FILE_RE) || trimmed;
    return { kind: "file", topic };
  }

  if (SEARCH_RE.test(trimmed)) {
    const query = stripLeadIn(trimmed, SEARCH_RE) || trimmed;
    return { kind: "search", query };
  }

  // A fenced code block in the message is as strong a signal as any keyword.
  if (CODE_RE.test(trimmed) || /```/.test(trimmed)) {
    return { kind: "code" };
  }

  if (STUDY_RE.test(trimmed)) {
    return { kind: "study" };
  }

  if (PPT_RE.test(trimmed)) {
    let topic = extractPptTopic(trimmed);
    // No real topic in this message on its own (e.g. "send me .pptx
    // file", "make me a ppt please") — fall back to the previous user
    // message, which is almost always the actual topic ("tell me about
    // the water cycle" -> "send me .pptx file"). If there's nothing
    // usable there either, keep the original trimmed message rather than
    // silently building a deck about "file".
    if (isEmptyPptTopic(topic)) {
      const fallback = priorUserMessage?.trim();
      topic = fallback && !isEmptyPptTopic(fallback) ? fallback : trimmed;
    }
    return { kind: "ppt", topic };
  }

  return { kind: "normal" };
}
