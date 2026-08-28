-- NexPrompt — Phase 18: Pinned chats sync
-- Run this after supabase/migrations/phase17_chat_sync.sql.
--
-- Pinning a chat (sidebar redesign) needs to follow the account across
-- devices the same way renames/messages already do via Phase 17's
-- chat_conversations sync, so it's a real column here rather than a
-- client-only localStorage flag.
--
-- Safe to run multiple times.

alter table public.chat_conversations
  add column if not exists pinned boolean not null default false;
