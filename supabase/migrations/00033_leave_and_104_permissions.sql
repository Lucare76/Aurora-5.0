-- Sprint 33: Ferie e permessi 104, modulo HR privato.
-- Nessun collegamento a contabilità, movimenti, budget o AI.

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

create table if not exists public.leave_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vacation_days_per_year numeric not null default 30,
  permit_104_hours_per_month numeric not null default 24,
  timezone text not null default 'Europe/Rome',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_settings_user_unique unique (user_id),
  constraint leave_settings_allowance_check check (
    vacation_days_per_year >= 0
    and permit_104_hours_per_month >= 0
  )
);

create table if not exists public.leave_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  start_date date not null,
  end_date date not null,
  days numeric,
  hours numeric,
  start_time time,
  end_time time,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_entries_type_check check (type in ('VACATION', 'PERMIT_104')),
  constraint leave_entries_date_check check (end_date >= start_date),
  constraint leave_entries_days_check check (days is null or days >= 0),
  constraint leave_entries_hours_check check (hours is null or hours >= 0),
  constraint leave_entries_vacation_check check (
    (type = 'VACATION' and days is not null and hours is null)
    or (type = 'PERMIT_104' and hours is not null and days is null)
  )
);

alter table public.leave_settings enable row level security;
alter table public.leave_entries enable row level security;

drop policy if exists "leave_settings_select_own" on public.leave_settings;
create policy "leave_settings_select_own" on public.leave_settings
for select using ((select auth.uid()) = user_id);

drop policy if exists "leave_settings_insert_own" on public.leave_settings;
create policy "leave_settings_insert_own" on public.leave_settings
for insert with check ((select auth.uid()) = user_id);

drop policy if exists "leave_settings_update_own" on public.leave_settings;
create policy "leave_settings_update_own" on public.leave_settings
for update using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "leave_entries_select_own" on public.leave_entries;
create policy "leave_entries_select_own" on public.leave_entries
for select using ((select auth.uid()) = user_id);

drop policy if exists "leave_entries_insert_own" on public.leave_entries;
create policy "leave_entries_insert_own" on public.leave_entries
for insert with check ((select auth.uid()) = user_id);

drop policy if exists "leave_entries_update_own" on public.leave_entries;
create policy "leave_entries_update_own" on public.leave_entries
for update using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "leave_entries_delete_own" on public.leave_entries;
create policy "leave_entries_delete_own" on public.leave_entries
for delete using ((select auth.uid()) = user_id);

create index if not exists idx_leave_entries_user_date
  on public.leave_entries(user_id, start_date desc);
create index if not exists idx_leave_entries_user_type_date
  on public.leave_entries(user_id, type, start_date desc);

drop trigger if exists set_updated_at_leave_settings on public.leave_settings;
create trigger set_updated_at_leave_settings
before update on public.leave_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_leave_entries on public.leave_entries;
create trigger set_updated_at_leave_entries
before update on public.leave_entries
for each row execute function public.set_updated_at();

revoke all on public.leave_settings from public;
revoke all on public.leave_entries from public;
grant select, insert, update on public.leave_settings to authenticated;
grant select, insert, update, delete on public.leave_entries to authenticated;
