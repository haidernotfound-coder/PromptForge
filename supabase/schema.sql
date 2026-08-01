-- PromptForge 2.0 — initial schema (Phase 1: Foundation)
-- Run this in the Supabase SQL editor, or via `supabase db push`.

create extension if not exists "uuid-ossp";

-- Profiles ------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles are editable by owner"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Folders ---------------------------------------------------------------

create table if not exists public.folders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  parent_id uuid references public.folders(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.folders enable row level security;

create policy "Folders are managed by owner"
  on public.folders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Tags --------------------------------------------------------------------

create table if not exists public.tags (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#6E56CF',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.tags enable row level security;

create policy "Tags are managed by owner"
  on public.tags for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Prompts -------------------------------------------------------------------

create table if not exists public.prompts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid references public.folders(id) on delete set null,
  title text not null,
  body text not null default '',
  model text,
  is_favorite boolean not null default false,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.prompts enable row level security;

create policy "Prompts are managed by owner"
  on public.prompts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Public prompts are readable by anyone"
  on public.prompts for select
  using (is_public = true);

create index if not exists prompts_user_id_idx on public.prompts(user_id);
create index if not exists prompts_folder_id_idx on public.prompts(folder_id);
create index if not exists prompts_search_idx
  on public.prompts using gin (to_tsvector('english', title || ' ' || body));

-- Prompt <-> Tag join table -------------------------------------------------

create table if not exists public.prompt_tags (
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (prompt_id, tag_id)
);

alter table public.prompt_tags enable row level security;

create policy "Prompt tags are managed by prompt owner"
  on public.prompt_tags for all
  using (
    exists (
      select 1 from public.prompts
      where prompts.id = prompt_tags.prompt_id
      and prompts.user_id = auth.uid()
    )
  );

-- Prompt version history (Phase 4 groundwork) -------------------------------

create table if not exists public.prompt_versions (
  id uuid primary key default uuid_generate_v4(),
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  body text not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.prompt_versions enable row level security;

create policy "Prompt versions are managed by prompt owner"
  on public.prompt_versions for all
  using (
    exists (
      select 1 from public.prompts
      where prompts.id = prompt_versions.prompt_id
      and prompts.user_id = auth.uid()
    )
  );

-- Collections (Phase 5 groundwork, wired up in Phase 7) --------------------

create table if not exists public.collections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.collections enable row level security;

create policy "Collections are managed by owner"
  on public.collections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Public collections are readable by anyone"
  on public.collections for select
  using (is_public = true);

create table if not exists public.collection_prompts (
  collection_id uuid not null references public.collections(id) on delete cascade,
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, prompt_id)
);

alter table public.collection_prompts enable row level security;

create policy "Collection prompts are managed by collection owner"
  on public.collection_prompts for all
  using (
    exists (
      select 1 from public.collections
      where collections.id = collection_prompts.collection_id
      and collections.user_id = auth.uid()
    )
  );

create policy "Collection prompts are readable when the collection is public"
  on public.collection_prompts for select
  using (
    exists (
      select 1 from public.collections
      where collections.id = collection_prompts.collection_id
      and collections.is_public = true
    )
  );

-- Workspace snapshot (Phase 7 sync) -----------------------------------------
-- The Phase 3–5 UI was built against a single client-side Zustand store
-- (prompts/folders/tags/collections together). Rather than re-plumb every
-- component to a fully normalized read/write path for this phase, Phase 7
-- persists that same store shape server-side, one JSONB row per user,
-- RLS-scoped so a user can only ever read or write their own snapshot. The
-- fully normalized tables above (prompts, folders, tags, collections, …)
-- remain in the schema as the target shape for a follow-up migration to
-- per-row sync (real-time subscriptions, partial updates, etc).

create table if not exists public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

create policy "Workspaces are managed by owner"
  on public.workspaces for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at trigger ---------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_prompts_updated_at on public.prompts;
create trigger set_prompts_updated_at
  before update on public.prompts
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_collections_updated_at on public.collections;
create trigger set_collections_updated_at
  before update on public.collections
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_workspaces_updated_at on public.workspaces;
create trigger set_workspaces_updated_at
  before update on public.workspaces
  for each row execute procedure public.set_updated_at();
