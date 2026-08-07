-- Sprint 32: provider AI personale per utente.
-- Le API key sono cifrate server-side e non fanno parte del backup finanziario.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.ai_provider_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'OPENAI',
  encrypted_api_key text,
  api_key_last4 text,
  enabled boolean not null default false,
  connection_status text not null default 'not_configured',
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_provider_settings_user_unique unique (user_id),
  constraint ai_provider_settings_provider_check check (provider in ('OPENAI', 'ANTHROPIC', 'GEMINI')),
  constraint ai_provider_settings_status_check check (connection_status in ('not_configured', 'configured', 'verified', 'error'))
);

alter table public.ai_provider_settings
  add column if not exists provider text not null default 'OPENAI';
alter table public.ai_provider_settings
  add column if not exists encrypted_api_key text;
alter table public.ai_provider_settings
  add column if not exists api_key_last4 text;
alter table public.ai_provider_settings
  add column if not exists enabled boolean not null default false;
alter table public.ai_provider_settings
  add column if not exists connection_status text not null default 'not_configured';
alter table public.ai_provider_settings
  add column if not exists last_checked_at timestamptz;
alter table public.ai_provider_settings
  add column if not exists last_error text;
alter table public.ai_provider_settings
  add column if not exists created_at timestamptz not null default now();
alter table public.ai_provider_settings
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_provider_settings_user_unique'
      and conrelid = 'public.ai_provider_settings'::regclass
  ) then
    alter table public.ai_provider_settings
      add constraint ai_provider_settings_user_unique unique (user_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_provider_settings_provider_check'
      and conrelid = 'public.ai_provider_settings'::regclass
  ) then
    alter table public.ai_provider_settings
      add constraint ai_provider_settings_provider_check check (provider in ('OPENAI', 'ANTHROPIC', 'GEMINI'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_provider_settings_status_check'
      and conrelid = 'public.ai_provider_settings'::regclass
  ) then
    alter table public.ai_provider_settings
      add constraint ai_provider_settings_status_check check (connection_status in ('not_configured', 'configured', 'verified', 'error'));
  end if;
end $$;

create index if not exists idx_ai_provider_settings_user
  on public.ai_provider_settings(user_id);

alter table public.ai_provider_settings enable row level security;

drop policy if exists "ai_provider_settings_select_own" on public.ai_provider_settings;
create policy "ai_provider_settings_select_own"
on public.ai_provider_settings
for select
using ((select auth.uid()) = user_id);

drop policy if exists "ai_provider_settings_insert_own" on public.ai_provider_settings;
create policy "ai_provider_settings_insert_own"
on public.ai_provider_settings
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "ai_provider_settings_update_own" on public.ai_provider_settings;
create policy "ai_provider_settings_update_own"
on public.ai_provider_settings
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "ai_provider_settings_delete_own" on public.ai_provider_settings;
create policy "ai_provider_settings_delete_own"
on public.ai_provider_settings
for delete
using ((select auth.uid()) = user_id);

drop trigger if exists set_updated_at_ai_provider_settings on public.ai_provider_settings;
create trigger set_updated_at_ai_provider_settings
before update on public.ai_provider_settings
for each row
execute function public.set_updated_at();

revoke all on public.ai_provider_settings from public;
grant select, insert, update, delete on public.ai_provider_settings to authenticated;
