-- NexPrompt — Phase 16: PPTForge feature toggle + admin visibility
-- Run this after supabase/migrations/phase15_studyforge.sql.
--
-- PPTForge (the fourth NexPrompt product, at /pptforge) already logs
-- "pptforge.generate" events into public.admin_events and usage into
-- public.groq_key_usage under the "pptforge" pool — both free-form text
-- columns, so no schema change was needed for those (see
-- src/lib/admin/store.ts). What was missing is a feature toggle for
-- PPTForge alongside the existing codeforge_enabled / studyforge_enabled
-- columns on the system_settings singleton row, which is why PPTForge
-- couldn't be switched off from the admin dashboard and why an admin
-- couldn't tell it apart from "not configured".
--
-- Safe to run multiple times.

alter table public.system_settings
  add column if not exists pptforge_enabled boolean not null default true;
