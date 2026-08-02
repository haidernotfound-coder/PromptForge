/**
 * Tracks which Groq key index last succeeded, per key pool, per server
 * instance. Previously each of `api/ai/route.ts` and `api/forge-ai/route.ts`
 * kept its own private `let lastGoodKeyIndex` module variable doing the
 * exact same job — factored out here so the logic isn't duplicated and so
 * the admin Groq Monitor can read the same state those routes use to pick
 * a starting key, instead of guessing separately.
 */

export type GroqPool = "ai" | "forge_ai" | "codeforge";

const lastGoodIndex: Record<GroqPool, number> = { ai: 0, forge_ai: 0, codeforge: 0 };

export function getLastGoodKeyIndex(pool: GroqPool): number {
  return lastGoodIndex[pool];
}

export function setLastGoodKeyIndex(pool: GroqPool, index: number): void {
  lastGoodIndex[pool] = index;
}
