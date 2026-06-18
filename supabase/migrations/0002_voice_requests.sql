-- Voice-request queue: captures molecules that don't have a baked voice yet,
-- so their Ava audio can be pre-rendered and added to the library.
-- Paste into the Supabase SQL Editor (Run). Safe to re-run.

create table if not exists public.voice_requests (
  slug            text primary key,
  name            text not null,
  count           int  not null default 0,
  first_requested timestamptz not null default now(),
  last_requested  timestamptz not null default now()
);

alter table public.voice_requests enable row level security;
-- No select/insert policies for users: rows are written only via the SECURITY
-- DEFINER function below, and read by the owner via the dashboard/service role.

-- Called by signed-in users (RPC) when they hit a molecule with no baked voice.
-- SECURITY DEFINER so it can upsert past RLS; slugify mirrors the frontend.
create or replace function public.request_voice(p_name text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare s text;
begin
  if p_name is null then return; end if;
  s := regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g');
  s := regexp_replace(s, '^-|-$', '', 'g');
  if s = '' then return; end if;
  insert into public.voice_requests (slug, name, count)
    values (s, p_name, 1)
  on conflict (slug) do update
    set count = public.voice_requests.count + 1,
        last_requested = now();
end;
$$;

revoke all on function public.request_voice(text) from public, anon;
grant execute on function public.request_voice(text) to authenticated;
