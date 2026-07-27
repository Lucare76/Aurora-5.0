-- Sprint 13B: Notification preferences, snooze, source mutes, quiet hours.
-- Local migration only. Do not apply to production without staging validation.
-- Idempotent: safe to re-run after partial execution.

begin;

-- ============================================================
-- 1. NOTIFICATION_USER_SETTINGS
-- Global per-user preferences: enable/disable, severity filters,
-- quiet hours, digest schedule.
-- ============================================================

create table if not exists public.notification_user_settings (
  user_id               uuid not null primary key references auth.users(id) on delete cascade,
  notifications_enabled boolean not null default true,
  show_info             boolean not null default true,
  show_warning          boolean not null default true,
  show_critical         boolean not null default true,
  quiet_hours_enabled   boolean not null default false,
  quiet_hours_start     time without time zone,
  quiet_hours_end       time without time zone,
  digest_enabled        boolean not null default false,
  digest_frequency      text,
  digest_time           time without time zone,
  timezone              text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.notification_user_settings'::regclass
      and conname = 'notification_user_settings_digest_frequency_check'
  ) then
    alter table public.notification_user_settings
      add constraint notification_user_settings_digest_frequency_check
        check (digest_frequency in ('DAILY', 'WEEKLY'));
  end if;
end $$;

-- ============================================================
-- 2. NOTIFICATION_PREFERENCES
-- Per-type toggles and configuration (JSONB).
-- One row per (user_id, notification_type).
-- ============================================================

create table if not exists public.notification_preferences (
  id                uuid not null primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  is_enabled        boolean not null default true,
  config            jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.notification_preferences'::regclass
      and conname = 'notification_preferences_type_check'
  ) then
    alter table public.notification_preferences
      add constraint notification_preferences_type_check
        check (notification_type in (
          'negative_projected_balance', 'budget_threshold',
          'overdue_recurrence', 'upcoming_recurrence',
          'upcoming_loan_payment', 'overdue_loan_payment', 'loan_due_soon',
          'goal_behind_schedule', 'automation_failure', 'automation_conflict',
          'possible_duplicate'
        ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.notification_preferences'::regclass
      and conname = 'notification_preferences_user_type_unique'
  ) then
    alter table public.notification_preferences
      add constraint notification_preferences_user_type_unique
        unique (user_id, notification_type);
  end if;
end $$;

-- ============================================================
-- 3. NOTIFICATION_SOURCE_MUTES
-- Silence notifications from a specific source (account, budget,
-- loan, etc.) for a specific type or all types.
-- notification_type null = all types for that source.
-- muted_until null = indefinite silence.
-- ============================================================

create table if not exists public.notification_source_mutes (
  id                uuid not null primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  source_type       text not null,
  source_id         uuid not null,
  notification_type text,
  muted_until       timestamptz,
  reason            text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.notification_source_mutes'::regclass
      and conname = 'notification_source_mutes_source_type_check'
  ) then
    alter table public.notification_source_mutes
      add constraint notification_source_mutes_source_type_check
        check (source_type in (
          'account', 'budget', 'recurring_rule', 'savings_goal',
          'loan', 'automation', 'transaction'
        ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.notification_source_mutes'::regclass
      and conname = 'notification_source_mutes_type_check'
  ) then
    alter table public.notification_source_mutes
      add constraint notification_source_mutes_type_check
        check (notification_type in (
          'negative_projected_balance', 'budget_threshold',
          'overdue_recurrence', 'upcoming_recurrence',
          'upcoming_loan_payment', 'overdue_loan_payment', 'loan_due_soon',
          'goal_behind_schedule', 'automation_failure', 'automation_conflict',
          'possible_duplicate'
        ));
  end if;
end $$;

-- Unique index: handle nullable notification_type via two partial indexes
create unique index if not exists notification_source_mutes_with_type
  on public.notification_source_mutes (user_id, source_type, source_id, notification_type)
  where notification_type is not null;

create unique index if not exists notification_source_mutes_all_types
  on public.notification_source_mutes (user_id, source_type, source_id)
  where notification_type is null;

-- ============================================================
-- 4. NEW COLUMNS ON notifications
-- snoozed_until: notification hidden until this timestamp
-- last_snoozed_at: when the user last triggered a snooze
-- ============================================================

alter table public.notifications
  add column if not exists snoozed_until   timestamptz,
  add column if not exists last_snoozed_at timestamptz;

-- ============================================================
-- 5. INDEXES
-- ============================================================

create index if not exists notification_preferences_user_id
  on public.notification_preferences (user_id);

create index if not exists notification_source_mutes_user_id
  on public.notification_source_mutes (user_id);

create index if not exists notification_source_mutes_source
  on public.notification_source_mutes (user_id, source_type, source_id);

create index if not exists notification_source_mutes_expiry
  on public.notification_source_mutes (muted_until)
  where muted_until is not null;

create index if not exists notifications_snoozed
  on public.notifications (user_id, snoozed_until)
  where snoozed_until is not null;

-- ============================================================
-- 6. UPDATED_AT TRIGGERS
-- ============================================================

drop trigger if exists set_updated_at_notification_user_settings
  on public.notification_user_settings;
create trigger set_updated_at_notification_user_settings
  before update on public.notification_user_settings
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_notification_preferences
  on public.notification_preferences;
create trigger set_updated_at_notification_preferences
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_notification_source_mutes
  on public.notification_source_mutes;
create trigger set_updated_at_notification_source_mutes
  before update on public.notification_source_mutes
  for each row execute function public.set_updated_at();

-- ============================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================

alter table public.notification_user_settings enable row level security;
alter table public.notification_preferences    enable row level security;
alter table public.notification_source_mutes   enable row level security;

-- notification_user_settings (1 row per user)
drop policy if exists "notification_user_settings_select" on public.notification_user_settings;
create policy "notification_user_settings_select" on public.notification_user_settings
  for select using ((select auth.uid()) = user_id);

drop policy if exists "notification_user_settings_insert" on public.notification_user_settings;
create policy "notification_user_settings_insert" on public.notification_user_settings
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "notification_user_settings_update" on public.notification_user_settings;
create policy "notification_user_settings_update" on public.notification_user_settings
  for update using ((select auth.uid()) = user_id);

drop policy if exists "notification_user_settings_delete" on public.notification_user_settings;
create policy "notification_user_settings_delete" on public.notification_user_settings
  for delete using ((select auth.uid()) = user_id);

-- notification_preferences
drop policy if exists "notification_preferences_select" on public.notification_preferences;
create policy "notification_preferences_select" on public.notification_preferences
  for select using ((select auth.uid()) = user_id);

drop policy if exists "notification_preferences_insert" on public.notification_preferences;
create policy "notification_preferences_insert" on public.notification_preferences
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "notification_preferences_update" on public.notification_preferences;
create policy "notification_preferences_update" on public.notification_preferences
  for update using ((select auth.uid()) = user_id);

drop policy if exists "notification_preferences_delete" on public.notification_preferences;
create policy "notification_preferences_delete" on public.notification_preferences
  for delete using ((select auth.uid()) = user_id);

-- notification_source_mutes
drop policy if exists "notification_source_mutes_select" on public.notification_source_mutes;
create policy "notification_source_mutes_select" on public.notification_source_mutes
  for select using ((select auth.uid()) = user_id);

drop policy if exists "notification_source_mutes_insert" on public.notification_source_mutes;
create policy "notification_source_mutes_insert" on public.notification_source_mutes
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "notification_source_mutes_update" on public.notification_source_mutes;
create policy "notification_source_mutes_update" on public.notification_source_mutes
  for update using ((select auth.uid()) = user_id);

drop policy if exists "notification_source_mutes_delete" on public.notification_source_mutes;
create policy "notification_source_mutes_delete" on public.notification_source_mutes
  for delete using ((select auth.uid()) = user_id);

commit;
