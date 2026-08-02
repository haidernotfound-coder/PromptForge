-- NexPrompt — Phase 14: CodeForge
-- Run this after supabase/migrations/phase13_admin_dashboard.sql.
--
-- CodeForge (the second NexPrompt product, at /codeforge) reuses every
-- existing table from Phase 13 as-is:
--   - public.admin_events     — `event_type` is a free-form text column, so
--                                the new "codeforge.*" event types (see
--                                src/lib/admin/store.ts) need no schema
--                                change to start being logged/read.
--   - public.groq_key_usage   — `key_pool` is likewise free-form text, so
--                                the new "codeforge" pool (7 dedicated Groq
--                                keys, configured via CODEFORGE_GROQ_API_KEY_1
--                                .. _7 env vars — see .env.example) needs no
--                                schema change either.
--
-- The one additive change actually needed is a feature toggle for CodeForge
-- alongside the existing forge_ai_enabled / recipe_forge_enabled /
-- critic_enabled columns on the system_settings singleton row.
--
-- Safe to run multiple times.

alter table public.system_settings
  add column if not exists codeforge_enabled boolean not null default true;
