/**
 * Tracks which Groq key index last succeeded, per key pool, per server
 * instance. Previously each of `api/ai/route.ts` and `api/forge-ai/route.ts`
 * kept its own private `let lastGoodKeyIndex` module variable doing the
 * exact same job — factored out here so the logic isn't duplicated and so
 * the admin Groq Monitor can read the same state those routes use to pick
 * a starting key, instead of guessing separately.
 */

export type GroqPool = "ai" | "forge_ai" | "codeforge" | "studyforge" | "pptforge";
export type GeminiPool = "gemini";

const lastGoodIndex: Record<GroqPool, number> = { ai: 0, forge_ai: 0, codeforge: 0, studyforge: 0, pptforge: 0 };
// Gemini is one shared pool across all three products (see lib/server/gemini.ts),
// tracked separately from the per-product Groq pools above.
let lastGoodGeminiIndex = 0;
// Voice Mode's Gemini Live key pool (GEMINI_VOICE_API_KEY_*) is fully
// separate from the attachment pool above — see getGeminiVoiceApiKeys in
// lib/supabase/config.ts — so it gets its own rotation cursor.
//
// Seeded to a random slot (0..11, clamped to whatever the actual pool size
// turns out to be by the modulo in voice-token/route.ts) rather than a
// fixed 0. Two reasons this matters specifically for this pool:
//   1. This module is a plain in-memory `let` — on a serverless/edge
//      deploy it resets on every cold start. Always seeding at 0 means a
//      cold start after key 0 gets exhausted keeps re-drawing the same
//      known-bad key first on every fresh instance, burning a mint+connect
//      round trip (which looks like "connecting -> listening -> connecting"
//      to the user) before ever reaching a live key.
//      Randomizing spreads cold-start load across the whole pool instead.
//   2. With many concurrent users, always starting at 0 means everyone's
//      *first* attempt piles onto the same key, so it hits per-key rate
//      limits fastest under load even when the pool overall has headroom.
// `setLastGoodGeminiVoiceKeyIndex` below still advances this cursor
// normally after every successful mint, so the pool keeps rotating
// forward from wherever it started -- this only changes the seed.
let lastGoodGeminiVoiceIndex = Math.floor(Math.random() * 12);

export function getLastGoodKeyIndex(pool: GroqPool): number {
  return lastGoodIndex[pool];
}

export function setLastGoodKeyIndex(pool: GroqPool, index: number): void {
  lastGoodIndex[pool] = index;
}

export function getLastGoodGeminiKeyIndex(): number {
  return lastGoodGeminiIndex;
}

export function setLastGoodGeminiKeyIndex(index: number): void {
  lastGoodGeminiIndex = index;
}

export function getLastGoodGeminiVoiceKeyIndex(): number {
  return lastGoodGeminiVoiceIndex;
}

export function setLastGoodGeminiVoiceKeyIndex(index: number): void {
  lastGoodGeminiVoiceIndex = index;
}
 