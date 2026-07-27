create table if not exists public.financial_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_key text not null,
  period_start date not null,
  period_end date not null,
  total_score numeric null,
  level text null,
  is_provisional boolean not null default false,
  data_quality text not null,
  observed_weight numeric not null default 0,
  metrics jsonb not null default '{}'::jsonb,
  component_scores jsonb not null default '{}'::jsonb,
  factors jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  calculation_version text not null,
  calculated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.financial_health_snapshots
  add column if not exists user_id uuid,
  add column if not exists period_key text,
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists total_score numeric,
  add column if not exists level text,
  add column if not exists is_provisional boolean default false,
  add column if not exists data_quality text,
  add column if not exists observed_weight numeric default 0,
  add column if not exists metrics jsonb default '{}'::jsonb,
  add column if not exists component_scores jsonb default '{}'::jsonb,
  add column if not exists factors jsonb default '[]'::jsonb,
  add column if not exists recommendations jsonb default '[]'::jsonb,
  add column if not exists calculation_version text,
  add column if not exists calculated_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.financial_health_snapshots
  alter column is_provisional set default false,
  alter column observed_weight set default 0,
  alter column metrics set default '{}'::jsonb,
  alter column component_scores set default '{}'::jsonb,
  alter column factors set default '[]'::jsonb,
  alter column recommendations set default '[]'::jsonb,
  alter column created_at set default now(),
  alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'financial_health_snapshots_user_id_fkey'
      and conrelid = 'public.financial_health_snapshots'::regclass
  ) then
    alter table public.financial_health_snapshots
      add constraint financial_health_snapshots_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'financial_health_snapshots_unique_period_version'
      and conrelid = 'public.financial_health_snapshots'::regclass
  ) then
    alter table public.financial_health_snapshots
      add constraint financial_health_snapshots_unique_period_version
      unique (user_id, period_key, calculation_version);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'financial_health_snapshots_score_range'
      and conrelid = 'public.financial_health_snapshots'::regclass
  ) then
    alter table public.financial_health_snapshots
      add constraint financial_health_snapshots_score_range
      check (total_score is null or (total_score >= 0 and total_score <= 100));
  end if;
end $$;

create index if not exists financial_health_snapshots_user_period_idx
  on public.financial_health_snapshots (user_id, period_start desc);

create index if not exists financial_health_snapshots_user_calculated_idx
  on public.financial_health_snapshots (user_id, calculated_at desc);

create index if not exists financial_health_snapshots_user_level_idx
  on public.financial_health_snapshots (user_id, level);

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

alter table public.financial_health_snapshots enable row level security;

drop policy if exists "financial_health_snapshots_select_own" on public.financial_health_snapshots;
create policy "financial_health_snapshots_select_own"
on public.financial_health_snapshots
for select
using ((select auth.uid()) = user_id);

drop policy if exists "financial_health_snapshots_insert_own" on public.financial_health_snapshots;
create policy "financial_health_snapshots_insert_own"
on public.financial_health_snapshots
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "financial_health_snapshots_update_own" on public.financial_health_snapshots;
create policy "financial_health_snapshots_update_own"
on public.financial_health_snapshots
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop trigger if exists set_updated_at_financial_health_snapshots on public.financial_health_snapshots;
create trigger set_updated_at_financial_health_snapshots
before update on public.financial_health_snapshots
for each row execute function public.set_updated_at();
