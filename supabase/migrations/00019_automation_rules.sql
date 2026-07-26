-- Sprint 12: deterministic automation rules.
-- Local migration only. Do not apply to production without staging validation.

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  priority integer not null default 100,
  match_mode text not null default 'ALL',
  stop_processing boolean not null default true,
  apply_to_new_transactions boolean not null default false,
  archived boolean not null default false,
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automation_rules_name_length check (char_length(trim(name)) between 1 and 120),
  constraint automation_rules_description_length check (description is null or char_length(description) <= 500),
  constraint automation_rules_priority_range check (priority between 1 and 10000),
  constraint automation_rules_match_mode_check check (match_mode in ('ALL', 'ANY')),
  constraint automation_rules_conditions_array check (jsonb_typeof(conditions) = 'array' and jsonb_array_length(conditions) <= 10),
  constraint automation_rules_actions_array check (jsonb_typeof(actions) = 'array' and jsonb_array_length(actions) <= 10)
);

create table if not exists public.automation_application_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id uuid references public.automation_rules(id) on delete set null,
  mode text not null default 'BULK',
  status text not null default 'COMPLETED',
  transaction_count integer not null default 0,
  applied_count integer not null default 0,
  skipped_count integer not null default 0,
  conflict_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now(),
  reverted_at timestamptz,
  constraint automation_batches_mode_check check (mode in ('BULK')),
  constraint automation_batches_status_check check (status in ('COMPLETED', 'PARTIAL', 'FAILED', 'REVERTED', 'REVERT_CONFLICT')),
  constraint automation_batches_counts_check check (
    transaction_count >= 0 and applied_count >= 0 and skipped_count >= 0 and conflict_count >= 0 and failed_count >= 0
  )
);

create table if not exists public.automation_rule_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id uuid references public.automation_rules(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  application_batch_id uuid references public.automation_application_batches(id) on delete set null,
  application_mode text not null,
  previous_values jsonb not null default '{}'::jsonb,
  applied_values jsonb not null default '{}'::jsonb,
  result text not null,
  error_code text,
  applied_at timestamptz not null default now(),
  reverted_at timestamptz,
  constraint automation_applications_mode_check check (application_mode in ('SUGGESTED', 'MANUAL', 'AUTOMATIC', 'BULK')),
  constraint automation_applications_result_check check (result in ('APPLIED', 'SKIPPED', 'CONFLICT', 'FAILED', 'REVERTED')),
  constraint automation_applications_json_check check (jsonb_typeof(previous_values) = 'object' and jsonb_typeof(applied_values) = 'object')
);

alter table public.automation_rules
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists is_active boolean default true,
  add column if not exists priority integer default 100,
  add column if not exists match_mode text default 'ALL',
  add column if not exists stop_processing boolean default true,
  add column if not exists apply_to_new_transactions boolean default false,
  add column if not exists archived boolean default false,
  add column if not exists conditions jsonb default '[]'::jsonb,
  add column if not exists actions jsonb default '[]'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.automation_rules
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column user_id set not null,
  alter column name set not null,
  alter column is_active set default true,
  alter column is_active set not null,
  alter column priority set default 100,
  alter column priority set not null,
  alter column match_mode set default 'ALL',
  alter column match_mode set not null,
  alter column stop_processing set default true,
  alter column stop_processing set not null,
  alter column apply_to_new_transactions set default false,
  alter column apply_to_new_transactions set not null,
  alter column archived set default false,
  alter column archived set not null,
  alter column conditions set default '[]'::jsonb,
  alter column conditions set not null,
  alter column actions set default '[]'::jsonb,
  alter column actions set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.automation_application_batches
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists rule_id uuid,
  add column if not exists mode text default 'BULK',
  add column if not exists status text default 'COMPLETED',
  add column if not exists transaction_count integer default 0,
  add column if not exists applied_count integer default 0,
  add column if not exists skipped_count integer default 0,
  add column if not exists conflict_count integer default 0,
  add column if not exists failed_count integer default 0,
  add column if not exists created_at timestamptz default now(),
  add column if not exists reverted_at timestamptz;

alter table public.automation_application_batches
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column user_id set not null,
  alter column mode set default 'BULK',
  alter column mode set not null,
  alter column status set default 'COMPLETED',
  alter column status set not null,
  alter column transaction_count set default 0,
  alter column transaction_count set not null,
  alter column applied_count set default 0,
  alter column applied_count set not null,
  alter column skipped_count set default 0,
  alter column skipped_count set not null,
  alter column conflict_count set default 0,
  alter column conflict_count set not null,
  alter column failed_count set default 0,
  alter column failed_count set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

alter table public.automation_rule_applications
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists rule_id uuid,
  add column if not exists transaction_id uuid,
  add column if not exists application_batch_id uuid,
  add column if not exists application_mode text,
  add column if not exists previous_values jsonb default '{}'::jsonb,
  add column if not exists applied_values jsonb default '{}'::jsonb,
  add column if not exists result text,
  add column if not exists error_code text,
  add column if not exists applied_at timestamptz default now(),
  add column if not exists reverted_at timestamptz;

alter table public.automation_rule_applications
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column user_id set not null,
  alter column application_mode set not null,
  alter column previous_values set default '{}'::jsonb,
  alter column previous_values set not null,
  alter column applied_values set default '{}'::jsonb,
  alter column applied_values set not null,
  alter column result set not null,
  alter column applied_at set default now(),
  alter column applied_at set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.automation_rules'::regclass and conname = 'automation_rules_pkey') then
    alter table public.automation_rules add constraint automation_rules_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.automation_rules'::regclass and conname = 'automation_rules_user_id_fkey') then
    alter table public.automation_rules add constraint automation_rules_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.automation_rules'::regclass and conname = 'automation_rules_name_length') then
    alter table public.automation_rules add constraint automation_rules_name_length check (char_length(trim(name)) between 1 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.automation_rules'::regclass and conname = 'automation_rules_description_length') then
    alter table public.automation_rules add constraint automation_rules_description_length check (description is null or char_length(description) <= 500);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.automation_rules'::regclass and conname = 'automation_rules_priority_range') then
    alter table public.automation_rules add constraint automation_rules_priority_range check (priority between 1 and 10000);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.automation_rules'::regclass and conname = 'automation_rules_match_mode_check') then
    alter table public.automation_rules add constraint automation_rules_match_mode_check check (match_mode in ('ALL', 'ANY'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.automation_rules'::regclass and conname = 'automation_rules_conditions_array') then
    alter table public.automation_rules add constraint automation_rules_conditions_array check (jsonb_typeof(conditions) = 'array' and jsonb_array_length(conditions) <= 10);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.automation_rules'::regclass and conname = 'automation_rules_actions_array') then
    alter table public.automation_rules add constraint automation_rules_actions_array check (jsonb_typeof(actions) = 'array' and jsonb_array_length(actions) <= 10);
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.automation_application_batches'::regclass and conname = 'automation_application_batches_pkey') then
    alter table public.automation_application_batches add constraint automation_application_batches_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.automation_application_batches'::regclass and conname = 'automation_application_batches_user_id_fkey') then
    alter table public.automation_application_batches add constraint automation_application_batches_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.automation_application_batches'::regclass and conname = 'automation_application_batches_rule_id_fkey') then
    alter table public.automation_application_batches add constraint automation_application_batches_rule_id_fkey foreign key (rule_id) references public.automation_rules(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.automation_application_batches'::regclass and conname = 'automation_batches_mode_check') then
    alter table public.automation_application_batches add constraint automation_batches_mode_check check (mode in ('BULK'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.automation_application_batches'::regclass and conname = 'automation_batches_status_check') then
    alter table public.automation_application_batches add constraint automation_batches_status_check check (status in ('COMPLETED', 'PARTIAL', 'FAILED', 'REVERTED', 'REVERT_CONFLICT'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.automation_application_batches'::regclass and conname = 'automation_batches_counts_check') then
    alter table public.automation_application_batches add constraint automation_batches_counts_check check (
      transaction_count >= 0 and applied_count >= 0 and skipped_count >= 0 and conflict_count >= 0 and failed_count >= 0
    );
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.automation_rule_applications'::regclass and conname = 'automation_rule_applications_pkey') then
    alter table public.automation_rule_applications add constraint automation_rule_applications_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.automation_rule_applications'::regclass and conname = 'automation_rule_applications_user_id_fkey') then
    alter table public.automation_rule_applications add constraint automation_rule_applications_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.automation_rule_applications'::regclass and conname = 'automation_rule_applications_rule_id_fkey') then
    alter table public.automation_rule_applications add constraint automation_rule_applications_rule_id_fkey foreign key (rule_id) references public.automation_rules(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.automation_rule_applications'::regclass and conname = 'automation_rule_applications_transaction_id_fkey') then
    alter table public.automation_rule_applications add constraint automation_rule_applications_transaction_id_fkey foreign key (transaction_id) references public.transactions(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.automation_rule_applications'::regclass and conname = 'automation_rule_applications_application_batch_id_fkey') then
    alter table public.automation_rule_applications add constraint automation_rule_applications_application_batch_id_fkey foreign key (application_batch_id) references public.automation_application_batches(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.automation_rule_applications'::regclass and conname = 'automation_applications_mode_check') then
    alter table public.automation_rule_applications add constraint automation_applications_mode_check check (application_mode in ('SUGGESTED', 'MANUAL', 'AUTOMATIC', 'BULK'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.automation_rule_applications'::regclass and conname = 'automation_applications_result_check') then
    alter table public.automation_rule_applications add constraint automation_applications_result_check check (result in ('APPLIED', 'SKIPPED', 'CONFLICT', 'FAILED', 'REVERTED'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.automation_rule_applications'::regclass and conname = 'automation_applications_json_check') then
    alter table public.automation_rule_applications add constraint automation_applications_json_check check (jsonb_typeof(previous_values) = 'object' and jsonb_typeof(applied_values) = 'object');
  end if;
end;
$$;

create index if not exists idx_automation_rules_user_active
  on public.automation_rules(user_id, is_active, archived, priority, created_at, id);

create index if not exists idx_automation_rule_applications_user_transaction
  on public.automation_rule_applications(user_id, transaction_id);

create index if not exists idx_automation_rule_applications_batch
  on public.automation_rule_applications(application_batch_id);

create index if not exists idx_automation_rule_applications_rule_applied
  on public.automation_rule_applications(rule_id, applied_at desc);

create index if not exists idx_automation_batches_user_created
  on public.automation_application_batches(user_id, created_at desc);

alter table public.automation_rules enable row level security;
alter table public.automation_application_batches enable row level security;
alter table public.automation_rule_applications enable row level security;

drop policy if exists "Users can view own automation rules" on public.automation_rules;
create policy "Users can view own automation rules"
  on public.automation_rules for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own automation rules" on public.automation_rules;
create policy "Users can insert own automation rules"
  on public.automation_rules for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own automation rules" on public.automation_rules;
create policy "Users can update own automation rules"
  on public.automation_rules for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own automation rules" on public.automation_rules;
create policy "Users can delete own automation rules"
  on public.automation_rules for delete
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own automation batches" on public.automation_application_batches;
create policy "Users can view own automation batches"
  on public.automation_application_batches for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own automation batches" on public.automation_application_batches;
create policy "Users can insert own automation batches"
  on public.automation_application_batches for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own automation batches" on public.automation_application_batches;
create policy "Users can update own automation batches"
  on public.automation_application_batches for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can view own automation applications" on public.automation_rule_applications;
create policy "Users can view own automation applications"
  on public.automation_rule_applications for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own automation applications" on public.automation_rule_applications;
create policy "Users can insert own automation applications"
  on public.automation_rule_applications for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own automation applications" on public.automation_rule_applications;
create policy "Users can update own automation applications"
  on public.automation_rule_applications for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

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

drop trigger if exists set_updated_at on public.automation_rules;
create trigger set_updated_at before update on public.automation_rules
  for each row execute function public.set_updated_at();
