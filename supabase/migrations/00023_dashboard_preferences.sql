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

create table if not exists public.dashboard_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  visible_widgets jsonb not null default '["summary","financial-health","data-integrity","score-components","projected-balance","cash-flow","expense-coverage","budgets","deadlines","loans","goals","recommendations","priority-alerts","score-history"]'::jsonb,
  widget_order jsonb not null default '["summary","financial-health","data-integrity","projected-balance","cash-flow","score-components","expense-coverage","budgets","deadlines","loans","goals","recommendations","priority-alerts","score-history"]'::jsonb,
  compact_mode boolean not null default false,
  default_period text not null default 'current_month',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dashboard_preferences
  add column if not exists visible_widgets jsonb not null default '["summary","financial-health","data-integrity","score-components","projected-balance","cash-flow","expense-coverage","budgets","deadlines","loans","goals","recommendations","priority-alerts","score-history"]'::jsonb;

alter table public.dashboard_preferences
  add column if not exists widget_order jsonb not null default '["summary","financial-health","data-integrity","projected-balance","cash-flow","score-components","expense-coverage","budgets","deadlines","loans","goals","recommendations","priority-alerts","score-history"]'::jsonb;

alter table public.dashboard_preferences
  add column if not exists compact_mode boolean not null default false;

alter table public.dashboard_preferences
  add column if not exists default_period text not null default 'current_month';

alter table public.dashboard_preferences
  add column if not exists created_at timestamptz not null default now();

alter table public.dashboard_preferences
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'dashboard_preferences_default_period_check'
      and conrelid = 'public.dashboard_preferences'::regclass
  ) then
    alter table public.dashboard_preferences
      add constraint dashboard_preferences_default_period_check
      check (default_period in ('current_month', 'previous_month'));
  end if;
end;
$$;

alter table public.dashboard_preferences enable row level security;

drop policy if exists "Users can view own dashboard preferences" on public.dashboard_preferences;
create policy "Users can view own dashboard preferences"
on public.dashboard_preferences
for select
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own dashboard preferences" on public.dashboard_preferences;
create policy "Users can insert own dashboard preferences"
on public.dashboard_preferences
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own dashboard preferences" on public.dashboard_preferences;
create policy "Users can update own dashboard preferences"
on public.dashboard_preferences
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop trigger if exists dashboard_preferences_set_updated_at on public.dashboard_preferences;
create trigger dashboard_preferences_set_updated_at
before update on public.dashboard_preferences
for each row
execute function public.set_updated_at();

grant select, insert, update on public.dashboard_preferences to authenticated;
