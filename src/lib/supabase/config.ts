/**
 * Phase 7 — Backend & API Integration
 * ------------------------------------
 * PromptForge still needs to run with zero configuration (the README's
 * "no environment variables required" promise from Phases 1–6). Rather than
 * hard-requiring Supabase, every real-auth/real-persistence code path checks
 * `isSupabaseConfigured()` first and falls back to the Phase 1–6 local demo
 * mode (demo cookie session + localStorage-backed Zustand store) when it's
 * false. Set both env vars in `.env.local` (see `.env.example`) to switch
 * the whole app over to real accounts + a real Postgres database.
 */

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Returns every configured Groq API key, in order.
 *
 * Supports up to 5 keys via `GROQ_API_KEY_1`..`GROQ_API_KEY_5`, so that when
 * one key hits its daily/rate limit, the AI route can instantly retry the
 * request with the next one. `GROQ_API_KEY` (no suffix) is also honored,
 * as key 1, for backward compatibility with single-key setups.
 */
export function getGroqApiKeys(): string[] {
  const keys: string[] = [];
  const first = process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY;
  if (first) keys.push(first);
  for (let i = 2; i <= 5; i++) {
    const key = process.env[`GROQ_API_KEY_${i}`];
    if (key) keys.push(key);
  }
  return keys;
}

export function isAiConfigured(): boolean {
  return getGroqApiKeys().length > 0;
}
