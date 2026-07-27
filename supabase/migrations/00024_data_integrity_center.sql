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

create table if not exists public.data_integrity_scan_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'quick',
  status text not null default 'completed',
  ruleset_version text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  detected_count integer not null default 0,
  critical_count integer not null default 0,
  warning_count integer not null default 0,
  info_count integer not null default 0,
  error_code text,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.data_integrity_scan_runs
  add column if not exists mode text not null default 'quick',
  add column if not exists status text not null default 'completed',
  add column if not exists ruleset_version text not null default '2026.07.15',
  add column if not exists started_at timestamptz not null default now(),
  add column if not exists completed_at timestamptz,
  add column if not exists detected_count integer not null default 0,
  add column if not exists critical_count integer not null default 0,
  add column if not exists warning_count integer not null default 0,
  add column if not exists info_count integer not null default 0,
  add column if not exists error_code text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.data_integrity_issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fingerprint text not null,
  ruleset_version text not null,
  rule_code text not null,
  category text not null,
  severity text not null,
  status text not null default 'open',
  title text not null,
  description text not null,
  explanation text not null,
  impact text not null,
  recommendation text not null,
  confidence text not null default 'medium',
  entity_type text not null,
  entity_ids text[] not null default '{}'::text[],
  evidence jsonb not null default '[]'::jsonb,
  allowed_actions text[] not null default '{}'::text[],
  source_path text,
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  ignored_at timestamptz,
  ignored_reason text,
  acknowledged_at timestamptz,
  last_scan_run_id uuid references public.data_integrity_scan_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.data_integrity_issues
  add column if not exists fingerprint text not null default '',
  add column if not exists ruleset_version text not null default '2026.07.15',
  add column if not exists rule_code text not null default 'UNKNOWN',
  add column if not exists category text not null default 'references',
  add column if not exists severity text not null default 'INFO',
  add column if not exists status text not null default 'open',
  add column if not exists title text not null default '',
  add column if not exists description text not null default '',
  add column if not exists explanation text not null default '',
  add column if not exists impact text not null default '',
  add column if not exists recommendation text not null default '',
  add column if not exists confidence text not null default 'medium',
  add column if not exists entity_type text not null default 'unknown',
  add column if not exists entity_ids text[] not null default '{}'::text[],
  add column if not exists evidence jsonb not null default '[]'::jsonb,
  add column if not exists allowed_actions text[] not null default '{}'::text[],
  add column if not exists source_path text,
  add column if not exists first_detected_at timestamptz not null default now(),
  add column if not exists last_detected_at timestamptz not null default now(),
  add column if not exists resolved_at timestamptz,
  add column if not exists ignored_at timestamptz,
  add column if not exists ignored_reason text,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists last_scan_run_id uuid references public.data_integrity_scan_runs(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'data_integrity_scan_runs_mode_check' and conrelid = 'public.data_integrity_scan_runs'::regclass) then
    alter table public.data_integrity_scan_runs add constraint data_integrity_scan_runs_mode_check check (mode in ('quick', 'full', 'targeted'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'data_integrity_scan_runs_status_check' and conrelid = 'public.data_integrity_scan_runs'::regclass) then
    alter table public.data_integrity_scan_runs add constraint data_integrity_scan_runs_status_check check (status in ('running', 'completed', 'failed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'data_integrity_issues_status_check' and conrelid = 'public.data_integrity_issues'::regclass) then
    alter table public.data_integrity_issues add constraint data_integrity_issues_status_check check (status in ('open', 'acknowledged', 'ignored', 'resolved', 'stale'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'data_integrity_issues_severity_check' and conrelid = 'public.data_integrity_issues'::regclass) then
    alter table public.data_integrity_issues add constraint data_integrity_issues_severity_check check (severity in ('CRITICAL', 'WARNING', 'INFO'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'data_integrity_issues_confidence_check' and conrelid = 'public.data_integrity_issues'::regclass) then
    alter table public.data_integrity_issues add constraint data_integrity_issues_confidence_check check (confidence in ('high', 'medium', 'low'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'data_integrity_issues_user_fingerprint_key' and conrelid = 'public.data_integrity_issues'::regclass) then
    alter table public.data_integrity_issues add constraint data_integrity_issues_user_fingerprint_key unique (user_id, fingerprint);
  end if;
end;
$$;

create index if not exists data_integrity_scan_runs_user_started
  on public.data_integrity_scan_runs (user_id, started_at desc);

create index if not exists data_integrity_issues_user_status_severity
  on public.data_integrity_issues (user_id, status, severity, last_detected_at desc);

create index if not exists data_integrity_issues_rule
  on public.data_integrity_issues (user_id, rule_code);

drop trigger if exists data_integrity_issues_set_updated_at on public.data_integrity_issues;
create trigger data_integrity_issues_set_updated_at
before update on public.data_integrity_issues
for each row
execute function public.set_updated_at();

alter table public.data_integrity_scan_runs enable row level security;
alter table public.data_integrity_issues enable row level security;

drop policy if exists "Users can view own data integrity scan runs" on public.data_integrity_scan_runs;
create policy "Users can view own data integrity scan runs"
on public.data_integrity_scan_runs
for select
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own data integrity scan runs" on public.data_integrity_scan_runs;
create policy "Users can insert own data integrity scan runs"
on public.data_integrity_scan_runs
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own data integrity scan runs" on public.data_integrity_scan_runs;
create policy "Users can update own data integrity scan runs"
on public.data_integrity_scan_runs
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can view own data integrity issues" on public.data_integrity_issues;
create policy "Users can view own data integrity issues"
on public.data_integrity_issues
for select
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own data integrity issues" on public.data_integrity_issues;
create policy "Users can insert own data integrity issues"
on public.data_integrity_issues
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own data integrity issues" on public.data_integrity_issues;
create policy "Users can update own data integrity issues"
on public.data_integrity_issues
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.data_integrity_scan_runs to authenticated;
grant select, insert, update on public.data_integrity_issues to authenticated;
