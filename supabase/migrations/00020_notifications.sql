-- Sprint 13A: Internal notifications and financial alerts system.
-- Local migration only. Do not apply to production without staging validation.
-- Idempotent: safe to re-run after partial execution.

-- ============================================================
-- 1. NOTIFICATIONS TABLE
-- ============================================================
-- State model: is_read + archived_at + resolved_at (not a single status field).
-- This avoids mixing concerns: a notification can be read AND archived simultaneously.
-- CONDITION notifications (budget, balance, goals) auto-resolve when the condition clears.
-- EVENT notifications (automation failures, duplicates) never auto-resolve.

create table if not exists public.notifications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  type              text not null,
  severity          text not null,
  title             text not null,
  message           text not null,
  dedupe_key        text not null,
  source_type       text,
  source_id         uuid,
  source_url        text,
  metadata          jsonb not null default '{}'::jsonb,
  is_read           boolean not null default false,
  archived_at       timestamptz,
  resolved_at       timestamptz,
  first_detected_at timestamptz not null default now(),
  last_detected_at  timestamptz not null default now(),
  read_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Idempotent column additions (if table already existed without some columns)
alter table public.notifications
  add column if not exists source_type text,
  add column if not exists source_id uuid,
  add column if not exists source_url text,
  add column if not exists archived_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists read_at timestamptz;

-- ============================================================
-- 2. CONSTRAINTS (idempotent via DO blocks)
-- ============================================================

do $$
begin
  -- Unique constraint: one notification per user per dedupe_key
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and conname = 'notifications_user_dedupe_key'
  ) then
    alter table public.notifications
      add constraint notifications_user_dedupe_key unique (user_id, dedupe_key);
  end if;

  -- Severity values
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and conname = 'notifications_severity_check'
  ) then
    alter table public.notifications
      add constraint notifications_severity_check
      check (severity in ('INFO', 'WARNING', 'CRITICAL'));
  end if;

  -- Type values
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and conname = 'notifications_type_check'
  ) then
    alter table public.notifications
      add constraint notifications_type_check
      check (type in (
        'negative_projected_balance',
        'budget_threshold',
        'overdue_recurrence',
        'upcoming_recurrence',
        'upcoming_loan_payment',
        'overdue_loan_payment',
        'loan_due_soon',
        'goal_behind_schedule',
        'automation_failure',
        'automation_conflict',
        'possible_duplicate'
      ));
  end if;

  -- Source type values
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and conname = 'notifications_source_type_check'
  ) then
    alter table public.notifications
      add constraint notifications_source_type_check
      check (source_type is null or source_type in (
        'account', 'budget', 'recurring_rule', 'savings_goal',
        'loan', 'automation', 'transaction'
      ));
  end if;

  -- Metadata must be a JSON object
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and conname = 'notifications_metadata_object'
  ) then
    alter table public.notifications
      add constraint notifications_metadata_object
      check (jsonb_typeof(metadata) = 'object');
  end if;
end;
$$;

-- ============================================================
-- 3. INDEXES
-- ============================================================

-- Primary lookup: user's active (non-archived, non-resolved) notifications sorted by date
create index if not exists idx_notifications_user_active
  on public.notifications (user_id, created_at desc)
  where archived_at is null and resolved_at is null;

-- Unread count query
create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, is_read)
  where is_read = false and archived_at is null and resolved_at is null;

-- Severity filter
create index if not exists idx_notifications_user_severity
  on public.notifications (user_id, severity, created_at desc);

-- Type + last_detected for condition resolution
create index if not exists idx_notifications_user_type_detected
  on public.notifications (user_id, type, last_detected_at desc);

-- Source lookup (for notifications pointing to a specific entity)
create index if not exists idx_notifications_source
  on public.notifications (source_type, source_id)
  where source_id is not null;

-- Dedupe lookup (covered by the unique constraint, but explicit for explain plans)
create index if not exists idx_notifications_dedupe
  on public.notifications (user_id, dedupe_key);

-- ============================================================
-- 4. REFRESH COOLDOWN TABLE
-- ============================================================
-- One row per user, tracks last full refresh to enforce cooldown.

create table if not exists public.notification_refresh_cooldowns (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  last_refresh_at timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- 5. RLS
-- ============================================================

alter table public.notifications enable row level security;
alter table public.notification_refresh_cooldowns enable row level security;

-- Drop existing policies before re-creating (idempotent)
drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_insert_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
drop policy if exists "notifications_delete_own" on public.notifications;

drop policy if exists "notification_refresh_select_own" on public.notification_refresh_cooldowns;
drop policy if exists "notification_refresh_insert_own" on public.notification_refresh_cooldowns;
drop policy if exists "notification_refresh_update_own" on public.notification_refresh_cooldowns;

-- Notifications: users can only access their own
create policy "notifications_select_own"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "notifications_insert_own"
  on public.notifications for insert
  with check (auth.uid() = user_id);

create policy "notifications_update_own"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "notifications_delete_own"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- Refresh cooldowns: users can only access their own
create policy "notification_refresh_select_own"
  on public.notification_refresh_cooldowns for select
  using (auth.uid() = user_id);

create policy "notification_refresh_insert_own"
  on public.notification_refresh_cooldowns for insert
  with check (auth.uid() = user_id);

create policy "notification_refresh_update_own"
  on public.notification_refresh_cooldowns for update
  using (auth.uid() = user_id);
