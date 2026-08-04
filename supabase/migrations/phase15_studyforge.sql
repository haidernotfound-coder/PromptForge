-- NexPrompt — Phase 15: StudyForge
-- Run this after supabase/migrations/phase14_codeforge.sql.
--
-- StudyForge (the third NexPrompt product, at /studyforge) reuses every
-- existing table from Phase 13/14 as-is:
--   - public.admin_events     — `event_type` is a free-form text column, so
--                                the new "studyforge.*" event types (see
--                                src/lib/admin/store.ts) need no schema
--                                change to start being logged/read.
--   - public.groq_key_usage   — `key_pool` is likewise free-form text, so
--                                the new "studyforge" pool (10 dedicated
--                                Groq keys, configured via
--                                STUDYFORGE_GROQ_API_KEY_1 .. _10 env vars —
--                                see .env.example) needs no schema change
--                                either.
--
-- The one additive change actually needed is a feature toggle for
-- StudyForge alongside the existing forge_ai_enabled / recipe_forge_enabled
-- / critic_enabled / codeforge_enabled columns on the system_settings
-- singleton row.
--
-- Safe to run multiple times.

alter table public.system_settings
  add column if not exists studyforge_enabled boolean not null default true;
