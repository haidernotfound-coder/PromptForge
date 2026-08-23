/**
 * Phase 7 — Backend & API Integration
 * ------------------------------------
 * NexPrompt still needs to run with zero configuration (the README's
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

/**
 * Forge AI (the floating chat panel) deliberately uses its own,
 * independent Groq key pool — `FORGE_AI_GROQ_API_KEY_1`..`_5` (and
 * unsuffixed `FORGE_AI_GROQ_API_KEY` for a single key) — rather than
 * sharing `GROQ_API_KEY_*` with Improve/Rewrite/Expand/Shorten/Critique.
 * Same multi-key fallback shape, same reasoning, just a fully separate
 * pool so the two features can be rate-limited, billed, or rotated
 * independently.
 */
export function getForgeAiApiKeys(): string[] {
  const keys: string[] = [];
  const first = process.env.FORGE_AI_GROQ_API_KEY_1 || process.env.FORGE_AI_GROQ_API_KEY;
  if (first) keys.push(first);
  for (let i = 2; i <= 5; i++) {
    const key = process.env[`FORGE_AI_GROQ_API_KEY_${i}`];
    if (key) keys.push(key);
  }
  return keys;
}

export function isForgeAiConfigured(): boolean {
  return getForgeAiApiKeys().length > 0;
}

/**
 * CodeForge — the second NexPrompt product — gets its own, fully
 * independent Groq key pool, same shape as Forge AI's: `CODEFORGE_GROQ_API_KEY_1`
 * .. `CODEFORGE_GROQ_API_KEY_7` (and unsuffixed `CODEFORGE_GROQ_API_KEY` as
 * key 1, for a single-key setup). Seven slots rather than five, since
 * CodeForge fans out across nine tools (Generate, Fix Bugs, Optimize,
 * Explain, Convert, Unit Tests, Documentation, Review, and the AI Coding
 * Chat) and is expected to see more traffic per user than a single Improve
 * button. None of these keys are shared with, or interfere with,
 * `GROQ_API_KEY_*` (PromptForge's Improve/Rewrite/Expand/Shorten/Critique)
 * or `FORGE_AI_GROQ_API_KEY_*` (Forge AI chat) — three fully separate
 * pools, rotated, billed, and rate-limited independently.
 */
export function getCodeForgeApiKeys(): string[] {
  const keys: string[] = [];
  const first = process.env.CODEFORGE_GROQ_API_KEY_1 || process.env.CODEFORGE_GROQ_API_KEY;
  if (first) keys.push(first);
  for (let i = 2; i <= 7; i++) {
    const key = process.env[`CODEFORGE_GROQ_API_KEY_${i}`];
    if (key) keys.push(key);
  }
  return keys;
}

export function isCodeForgeConfigured(): boolean {
  return getCodeForgeApiKeys().length > 0;
}

/**
 * StudyForge — the third NexPrompt product — gets its own, fully
 * independent Groq key pool: `STUDYFORGE_GROQ_API_KEY_1` .. `_10` (and
 * unsuffixed `STUDYFORGE_GROQ_API_KEY` as key 1, for a single-key setup).
 * Ten slots — more than CodeForge's seven — since StudyForge fans out
 * across eight one-shot tools (Explain Concepts, Notes Generator,
 * Flashcards, Quiz Generator, Homework Helper, Study Planner, Notes
 * Summarizer, Exam Practice) plus AI Study Chat, and is expected to see
 * classroom-scale burst traffic (a whole class hitting Flashcards/Quiz at
 * once before an exam). None of these keys are shared with, or interfere
 * with, `GROQ_API_KEY_*`, `FORGE_AI_GROQ_API_KEY_*`, or
 * `CODEFORGE_GROQ_API_KEY_*` — four fully separate pools, rotated, billed,
 * and rate-limited independently.
 */
export function getStudyForgeApiKeys(): string[] {
  const keys: string[] = [];
  const first = process.env.STUDYFORGE_GROQ_API_KEY_1 || process.env.STUDYFORGE_GROQ_API_KEY;
  if (first) keys.push(first);
  for (let i = 2; i <= 10; i++) {
    const key = process.env[`STUDYFORGE_GROQ_API_KEY_${i}`];
    if (key) keys.push(key);
  }
  return keys;
}

export function isStudyForgeConfigured(): boolean {
  return getStudyForgeApiKeys().length > 0;
}

/**
 * PPTForge — the fourth NexPrompt product — gets its own Groq key pool:
 * `PPTFORGE_GROQ_API_KEY_1`..`_5` (and unsuffixed `PPTFORGE_GROQ_API_KEY` as
 * key 1). Five slots, same shape as CodeForge/Forge AI. If no PPTForge-
 * specific key is set, it falls back to the shared `GROQ_API_KEY_*` pool
 * (PromptForge's pool) so PPTForge still "just works" in a zero-extra-setup
 * install that already has `GROQ_API_KEY` configured — it only falls back,
 * never the other way around, so setting PPTFORGE_GROQ_API_KEY_* keeps
 * PPTForge's usage fully independent when you want it to be.
 */
export function getPptForgeApiKeys(): string[] {
  const keys: string[] = [];
  const first = process.env.PPTFORGE_GROQ_API_KEY_1 || process.env.PPTFORGE_GROQ_API_KEY;
  if (first) keys.push(first);
  for (let i = 2; i <= 5; i++) {
    const key = process.env[`PPTFORGE_GROQ_API_KEY_${i}`];
    if (key) keys.push(key);
  }
  return keys.length > 0 ? keys : getGroqApiKeys();
}

export function isPptForgeConfigured(): boolean {
  return getPptForgeApiKeys().length > 0;
}

/**
 * Env var name for each configured key, in order — e.g.
 * `["GROQ_API_KEY_1", "GROQ_API_KEY_2"]` (or `["GROQ_API_KEY"]` for a
 * single unsuffixed key). Used as a stable, non-secret label for the admin
 * Groq Monitor — the key values themselves are never returned.
 */
export function getGroqKeyLabels(): string[] {
  const labels: string[] = [];
  if (process.env.GROQ_API_KEY_1) labels.push("GROQ_API_KEY_1");
  else if (process.env.GROQ_API_KEY) labels.push("GROQ_API_KEY");
  for (let i = 2; i <= 5; i++) {
    if (process.env[`GROQ_API_KEY_${i}`]) labels.push(`GROQ_API_KEY_${i}`);
  }
  return labels;
}

export function getForgeAiKeyLabels(): string[] {
  const labels: string[] = [];
  if (process.env.FORGE_AI_GROQ_API_KEY_1) labels.push("FORGE_AI_GROQ_API_KEY_1");
  else if (process.env.FORGE_AI_GROQ_API_KEY) labels.push("FORGE_AI_GROQ_API_KEY");
  for (let i = 2; i <= 5; i++) {
    if (process.env[`FORGE_AI_GROQ_API_KEY_${i}`]) labels.push(`FORGE_AI_GROQ_API_KEY_${i}`);
  }
  return labels;
}

/** Same purpose as `getGroqKeyLabels`/`getForgeAiKeyLabels`, for the
 *  7-slot CodeForge pool. */
export function getCodeForgeKeyLabels(): string[] {
  const labels: string[] = [];
  if (process.env.CODEFORGE_GROQ_API_KEY_1) labels.push("CODEFORGE_GROQ_API_KEY_1");
  else if (process.env.CODEFORGE_GROQ_API_KEY) labels.push("CODEFORGE_GROQ_API_KEY");
  for (let i = 2; i <= 7; i++) {
    if (process.env[`CODEFORGE_GROQ_API_KEY_${i}`]) labels.push(`CODEFORGE_GROQ_API_KEY_${i}`);
  }
  return labels;
}

/** Same purpose as `getGroqKeyLabels`/`getForgeAiKeyLabels`, for the
 *  10-slot StudyForge pool. */
export function getStudyForgeKeyLabels(): string[] {
  const labels: string[] = [];
  if (process.env.STUDYFORGE_GROQ_API_KEY_1) labels.push("STUDYFORGE_GROQ_API_KEY_1");
  else if (process.env.STUDYFORGE_GROQ_API_KEY) labels.push("STUDYFORGE_GROQ_API_KEY");
  for (let i = 2; i <= 10; i++) {
    if (process.env[`STUDYFORGE_GROQ_API_KEY_${i}`]) labels.push(`STUDYFORGE_GROQ_API_KEY_${i}`);
  }
  return labels;
}

/** Same purpose as `getGroqKeyLabels`/`getForgeAiKeyLabels`, for the
 *  5-slot PPTForge pool. Falls back to `getGroqKeyLabels()` when no
 *  PPTForge-specific key is set, mirroring `getPptForgeApiKeys()`. */
export function getPptForgeKeyLabels(): string[] {
  const labels: string[] = [];
  if (process.env.PPTFORGE_GROQ_API_KEY_1) labels.push("PPTFORGE_GROQ_API_KEY_1");
  else if (process.env.PPTFORGE_GROQ_API_KEY) labels.push("PPTFORGE_GROQ_API_KEY");
  for (let i = 2; i <= 5; i++) {
    if (process.env[`PPTFORGE_GROQ_API_KEY_${i}`]) labels.push(`PPTFORGE_GROQ_API_KEY_${i}`);
  }
  return labels.length > 0 ? labels : getGroqKeyLabels();
}

/**
 * Gemini — the multimodal/attachment provider shared by Forge AI, CodeForge,
 * and StudyForge's chats. Normal text-only chat keeps using each product's
 * own Groq pool above; the moment a chat turn carries an attachment (image,
 * PDF, DOCX, ZIP, or anything the client sends up as an image/document), the
 * request is routed to Gemini instead, since it can actually read those file
 * types natively instead of Groq's text-only + limited-vision setup.
 *
 * One shared pool — `GEMINI_API_KEY_1`..`GEMINI_API_KEY_7` (and unsuffixed
 * `GEMINI_API_KEY` as key 1, for a single-key setup) — rather than a
 * separate pool per product, since attachment traffic is comparatively rare
 * next to normal chat traffic and doesn't need per-product quota isolation.
 * Same instant-retry-on-the-next-key shape as every Groq pool above.
 */
export function getGeminiApiKeys(): string[] {
  const keys: string[] = [];
  const first = process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY;
  if (first) keys.push(first);
  for (let i = 2; i <= 7; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key) keys.push(key);
  }
  return keys;
}

export function isGeminiConfigured(): boolean {
  return getGeminiApiKeys().length > 0;
}

/** Same purpose as `getGroqKeyLabels`, for the 7-slot Gemini pool. */
export function getGeminiKeyLabels(): string[] {
  const labels: string[] = [];
  if (process.env.GEMINI_API_KEY_1) labels.push("GEMINI_API_KEY_1");
  else if (process.env.GEMINI_API_KEY) labels.push("GEMINI_API_KEY");
  for (let i = 2; i <= 7; i++) {
    if (process.env[`GEMINI_API_KEY_${i}`]) labels.push(`GEMINI_API_KEY_${i}`);
  }
  return labels;
}
