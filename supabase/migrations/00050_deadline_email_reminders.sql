create table if not exists public.deadline_email_reminder_log (
  id uuid primary key default gen_random_uuid(),
  deadline_id uuid not null references public.personal_deadlines(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  due_date date not null,
  days_before integer not null check (days_before in (30, 14, 7, 3, 1, 0)),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint deadline_email_reminder_unique unique (deadline_id, due_date, days_before)
);

alter table public.deadline_email_reminder_log enable row level security;
revoke all on public.deadline_email_reminder_log from anon, authenticated;
-- Only the server-side service role writes the delivery log.
