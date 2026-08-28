/**
 * Web Access Addon — Groq Compound web search (text chat).
 *
 * The unified chat route (src/app/api/chat/route.ts) previously routed
 * "search the web" turns to Gemini's googleSearch grounding tool. This
 * addon moves *text-chat* web search to Groq's own built-in search system
 * instead — model `groq/compound`, which autonomously calls a server-side
 * web_search tool and returns citations alongside its answer — while
 * voice mode keeps using Gemini's Live API search grounding (see
 * lib/server/gemini.ts's callers and the voice-token route). Two
 * different providers for two different surfaces, each already wired to
 * the app's existing key pools:
 *
 *  - Text chat authenticates with the exact same FORGE_AI_GROQ_API_KEY_*
 *    pool (see getForgeAiApiKeys) the unified chat route already uses for
 *    every non-search reply — no new environment variable, no new
 *    fallback system. Compound is a model choice, not a different
 *    provider account.
 *  - Same rotation contract as callGroq in route.ts: start from whichever
 *    key last worked (the shared "forge_ai" pool cursor), retry the next
 *    key on a 401/403/429, stop immediately on any other failure since
 *    every remaining key would fail identically on a malformed/oversized
 *    request.
 *
 * Response shape intentionally mirrors GeminiCallResult's {output,
 * sources} so route.ts's search branch is a drop-in provider swap: no
 * changes needed anywhere sources are rendered (ChatMessage.sources,
 * chat-panel.tsx) or persisted.
 */

export interface GroqSearchSource {
  title: string;
  uri: string;
}

export type GroqSearchResult =
  | { ok: true; output: string; sources: GroqSearchSource[] }
  | { ok: false; exhausted: true } // 401/403/429 — try the next key
  | { ok: false; exhausted: false; status: number; detail?: string }; // other failure — stop retrying

export interface GroqSearchMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// groq/compound autonomously decides when to call its built-in web_search
// tool (and, less relevant here, code execution) — no separate "enable
// search" flag needed, matching the "automatically decide when web access
// is needed" requirement without any extra client-side heuristics beyond
// routing the turn here in the first place (see chat-intent.ts).
const COMPOUND_MODEL = "groq/compound";

interface GroqSearchResult_ {
  title?: string;
  url?: string;
}
interface GroqExecutedTool {
  search_results?: { results?: GroqSearchResult_[] };
}
interface GroqCompoundMessage {
  content?: string;
  executed_tools?: GroqExecutedTool[];
}

/** Pulls (title, url) pairs out of every executed_tools[].search_results
 *  the model actually used, de-duplicated by URL — mirrors
 *  extractSearchSources in lib/server/gemini.ts for the Gemini path, same
 *  best-effort/never-throws shape since executed_tools is only present
 *  when the model chose to search at all. */
function extractGroqSources(message: GroqCompoundMessage): GroqSearchSource[] {
  try {
    const seen = new Set<string>();
    const sources: GroqSearchSource[] = [];
    for (const tool of message.executed_tools ?? []) {
      for (const result of tool.search_results?.results ?? []) {
        const uri = result.url;
        if (!uri || seen.has(uri)) continue;
        seen.add(uri);
        sources.push({ title: result.title || uri, uri });
      }
    }
    return sources;
  } catch {
    return [];
  }
}

async function callGroqCompoundOnce(apiKey: string, messages: GroqSearchMessage[]): Promise<GroqSearchResult> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: COMPOUND_MODEL,
      max_tokens: 2000,
      temperature: 0.4,
      messages,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Groq Compound web search API error", response.status, detail);
    if (response.status === 429 || response.status === 401 || response.status === 403) {
      return { ok: false, exhausted: true };
    }
    return { ok: false, exhausted: false, status: response.status, detail: detail.slice(0, 500) };
  }

  const data = await response.json();
  const message: GroqCompoundMessage = data.choices?.[0]?.message ?? {};
  const output = (message.content ?? "").trim();
  if (!output) {
    return { ok: false, exhausted: false, status: 502, detail: "Empty response from Groq Compound" };
  }
  return { ok: true, output, sources: extractGroqSources(message) };
}

export interface GroqSearchOutcome {
  result: GroqSearchResult;
  /** Index (into `keys`) of the key that succeeded, so the caller can
   *  remember it as the next starting point — same convention as
   *  runGeminiChat's goodKeyIndex. */
  goodKeyIndex?: number;
}

/** Runs one Groq Compound web-search turn across the given key pool,
 *  starting from `startIndex` and wrapping around — identical rotation
 *  shape to callGroq's loop in route.ts, extracted here so route.ts's
 *  search branch is a single call instead of a duplicated retry loop. */
export async function runGroqSearch(
  keys: string[],
  messages: GroqSearchMessage[],
  startIndex: number
): Promise<GroqSearchOutcome> {
  const order = keys.map((_, i) => (startIndex + i) % keys.length);
  let lastResult: GroqSearchResult | null = null;

  for (const i of order) {
    const result = await callGroqCompoundOnce(keys[i], messages);
    lastResult = result;
    if (result.ok) {
      return { result, goodKeyIndex: i };
    }
    if (!result.exhausted) break; // permanent failure — every remaining key fails the same way
  }

  return { result: lastResult ?? { ok: false, exhausted: true } };
}
