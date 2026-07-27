-- Migration: 00025_financial_scenarios
-- Creates the financial_scenarios table for the What-if scenario simulation system.
-- All data is simulation-only: no real transactions, notifications, or snapshots are created.

create table if not exists public.financial_scenarios (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.profiles(id) on delete cascade,

  -- Identity
  name                    text not null check (char_length(name) between 1 and 200),
  description             text,

  -- Status: draft | ready | outdated | archived
  status                  text not null default 'draft'
                            check (status in ('draft', 'ready', 'outdated', 'archived')),

  -- Horizon
  horizon_months          integer not null check (horizon_months between 1 and 60),
  start_date              date not null,
  end_date                date not null,
  currency                text,

  -- Actions & assumptions (jsonb — engine-validated on write)
  actions                 jsonb not null default '[]'::jsonb,
  assumptions             jsonb not null default '{}'::jsonb,

  -- Engine metadata
  engine_version          text not null default '1.0.0',
  schema_version          integer not null default 1,
  action_registry_version text not null default '1.0.0',

  -- Calculation state
  baseline_as_of          date,
  last_calculated_at      timestamptz,
  result_summary          jsonb,

  -- UX
  is_favorite             boolean not null default false,

  -- Timestamps
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Indexes
create index if not exists financial_scenarios_user_id_idx
  on public.financial_scenarios(user_id);

create index if not exists financial_scenarios_user_status_idx
  on public.financial_scenarios(user_id, status)
  where status != 'archived';

create index if not exists financial_scenarios_user_favorite_idx
  on public.financial_scenarios(user_id, is_favorite)
  where is_favorite = true;

-- RLS
alter table public.financial_scenarios enable row level security;

create policy "Users can manage their own scenarios"
  on public.financial_scenarios
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Updated_at trigger (reuse pattern from other tables)
create or replace function public.set_financial_scenarios_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger financial_scenarios_updated_at
  before update on public.financial_scenarios
  for each row
  execute function public.set_financial_scenarios_updated_at();

-- Constraint: end_date >= start_date
alter table public.financial_scenarios
  add constraint financial_scenarios_date_range
    check (end_date >= start_date);

-- Comment
comment on table public.financial_scenarios is
  'What-if financial simulation scenarios. Simulation only — no real data is modified.';
