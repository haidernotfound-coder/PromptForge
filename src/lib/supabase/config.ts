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

export function isAiConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}
