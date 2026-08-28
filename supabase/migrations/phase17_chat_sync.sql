-- NexPrompt — Phase 17: Cross-device AI Chat history sync
-- Run this after supabase/migrations/phase16_pptforge_settings.sql.
--
-- Bug: AI Chat (src/lib/chat.ts) persisted conversations/messages only to
-- `window.localStorage`, scoped to the browser rather than the signed-in
-- account. Two devices signed into the same account therefore saw two
-- completely independent chat histories.
--
-- Fix: real per-row Postgres storage instead of a single JSON blob (unlike
-- `public.workspaces`, Phase 7's whole-snapshot sync) — conversations and
-- messages are edited independently and out of order (a rename on one
-- device, a new message on another, a delete on a third), so per-row
-- upserts let each change sync on its own without one device's push
-- clobbering another's concurrent edit to a *different* conversation. RLS
-- mirrors every other per-user table in this schema (folders, prompts,
-- tags): a row is only readable/writable by its own `user_id`.
--
-- Safe to run multiple times.

create table if not exists public.chat_conversations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  auto_titled boolean not null default true,
  kind text not null default 'text' check (kind in ('text', 'voice')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chat_conversations enable row level security;

create policy "Chat conversations are managed by owner"
  on public.chat_conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists chat_conversations_user_id_idx
  on public.chat_conversations(user_id);

create table if not exists public.chat_messages (
  id uuid primary key,
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  -- attachments/files/sources are small, message-shaped JSON already
  -- defined client-side in src/lib/chat.ts (ChatMessage) — stored as-is
  -- rather than normalized into their own tables, same tradeoff the rest
  -- of this schema makes for prompt metadata vs. fully relational tags.
  attachments jsonb,
  files jsonb,
  sources jsonb,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create policy "Chat messages are managed by owner"
  on public.chat_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists chat_messages_conversation_id_idx
  on public.chat_messages(conversation_id);
create index if not exists chat_messages_user_id_idx
  on public.chat_messages(user_id);

-- Keep conversation.updated_at current whenever its messages change, so
-- "most-recently-updated first" sidebar ordering (see loadChatConversations
-- in src/lib/chat.ts) reflects new messages, not just renames.
create or replace function public.touch_chat_conversation()
returns trigger as $$
begin
  update public.chat_conversations
  set updated_at = now()
  where id = coalesce(new.conversation_id, old.conversation_id);
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

drop trigger if exists on_chat_message_write on public.chat_messages;
create trigger on_chat_message_write
  after insert or update or delete on public.chat_messages
  for each row execute procedure public.touch_chat_conversation();
