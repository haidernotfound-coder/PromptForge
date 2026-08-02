-- NexPrompt — Phase 13: Admin Dashboard
-- Run this after supabase/schema.sql (or via `supabase db push`).
--
-- Adds:
--   - profiles.is_admin           — DB-level admin flag (defense in depth;
--                                    the app also honors an ADMIN_EMAILS env
--                                    var so admin works with zero DB setup).
--   - public.admin_events         — lightweight analytics/activity log.
--   - public.groq_key_usage       — per-key Groq request counters, so the
--                                    Groq API Monitor can show real usage.
--   - public.system_settings      — singleton row of feature toggles
--                                    (Forge AI / Recipe Forge / Critic /
--                                    Maintenance mode).
--   - public.admin_overview()     — security-definer RPC that aggregates
--                                    cross-user counts (total users, prompts
--                                    created today, ...). Regular RLS on
--                                    `profiles`/`prompts` is owner-scoped, so
--                                    this function is the only supported way
--                                    to read aggregate numbers, and it
--                                    refuses to run for anyone whose profile
--                                    isn't flagged `is_admin`.
--
-- Everything here is additive and safe to run multiple times.

-- Admin flag ------------------------------------------------------------

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Helper: is the current authenticated user an admin? -----------------------

create or replace function public.is_admin()
returns boolean as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$ language sql stable security definer set search_path = public;

-- Analytics / activity events --------------------------------------------

create table if not exists public.admin_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  user_label text,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  success boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists admin_events_created_at_idx on public.admin_events(created_at desc);
create index if not exists admin_events_event_type_idx on public.admin_events(event_type);

alter table public.admin_events enable row level security;

-- Any signed-in request (including the app's own server routes acting on a
-- user's behalf) may append an event — this is a write-only log from the
-- caller's point of view. Reading aggregate/raw data back is restricted to
-- admins so one user's activity is never exposed to another.
create policy "Events can be inserted by any authenticated request"
  on public.admin_events for insert
  with check (true);

create policy "Events are readable by admins only"
  on public.admin_events for select
  using (public.is_admin());

-- Groq key usage counters -------------------------------------------------

create table if not exists public.groq_key_usage (
  key_pool text not null,
  key_label text not null,
  usage_date date not null default current_date,
  request_count int not null default 0,
  success_count int not null default 0,
  failure_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (key_pool, key_label, usage_date)
);

alter table public.groq_key_usage enable row level security;

create policy "Groq usage can be upserted by any authenticated request"
  on public.groq_key_usage for all
  using (public.is_admin())
  with check (true);

create policy "Groq usage is readable by admins only"
  on public.groq_key_usage for select
  using (public.is_admin());

-- System settings (singleton row) -----------------------------------------

create table if not exists public.system_settings (
  id boolean primary key default true,
  forge_ai_enabled boolean not null default true,
  recipe_forge_enabled boolean not null default true,
  critic_enabled boolean not null default true,
  maintenance_mode boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint system_settings_singleton check (id)
);

insert into public.system_settings (id) values (true) on conflict (id) do nothing;

alter table public.system_settings enable row level security;

create policy "Settings are readable by anyone signed in"
  on public.system_settings for select
  using (true);

create policy "Settings are editable by admins only"
  on public.system_settings for update
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists set_system_settings_updated_at on public.system_settings;
create trigger set_system_settings_updated_at
  before update on public.system_settings
  for each row execute procedure public.set_updated_at();

-- Admin overview RPC --------------------------------------------------------

create or replace function public.admin_overview()
returns jsonb as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin_overview: permission denied';
  end if;

  select jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'active_today', (
      select count(distinct user_id) from public.admin_events
      where created_at >= date_trunc('day', now()) and user_id is not null
    ),
    'prompts_created_total', (select count(*) from public.prompts),
    'prompts_created_today', (
      select count(*) from public.prompts where created_at >= date_trunc('day', now())
    ),
    'new_users_today', (
      select count(*) from auth.users where created_at >= date_trunc('day', now())
    )
  ) into result;

  return result;
end;
$$ language plpgsql stable security definer set search_path = public;
