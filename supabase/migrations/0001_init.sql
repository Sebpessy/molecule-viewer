-- Molecular Specimen Viewer — Phase 2 schema.
-- Paste this whole file into the Supabase SQL Editor (Run). Safe to re-run.

-- ===== profiles (1:1 with auth.users; plan column is the future paid-tier gate) =====
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  plan        text not null default 'free',
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "own profile update" on public.profiles;
create policy "own profile read"   on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- auto-create a profile row on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== lists (named, playable molecule lists) =====
create table if not exists public.lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  molecules   jsonb not null default '[]'::jsonb,
  settings    jsonb not null default
                '{"secondsEach":20,"voice":true,"music":true,"track":0,"loop":false}'::jsonb,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists lists_user_idx on public.lists(user_id, sort_order);

alter table public.lists enable row level security;

drop policy if exists "own lists read"   on public.lists;
drop policy if exists "own lists insert" on public.lists;
drop policy if exists "own lists update" on public.lists;
drop policy if exists "own lists delete" on public.lists;
create policy "own lists read"   on public.lists for select using (auth.uid() = user_id);
create policy "own lists insert" on public.lists for insert with check (auth.uid() = user_id);
create policy "own lists update" on public.lists for update using (auth.uid() = user_id);
create policy "own lists delete" on public.lists for delete using (auth.uid() = user_id);

-- ===== tts_usage (Phase 3 rate limiting / metering) =====
create table if not exists public.tts_usage (
  user_id  uuid not null references auth.users(id) on delete cascade,
  day      date not null default current_date,
  count    int  not null default 0,
  primary key (user_id, day)
);

alter table public.tts_usage enable row level security;

drop policy if exists "own usage read" on public.tts_usage;
create policy "own usage read" on public.tts_usage for select using (auth.uid() = user_id);
