-- Migration 00005: tabella log per evitare email duplicate sui compleanni

create table if not exists public.birthday_reminder_log (
  id          uuid primary key default gen_random_uuid(),
  birthday_id uuid not null references public.birthdays(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  days_before int not null,
  year        int not null,
  sent_at     timestamptz not null default now(),
  unique (birthday_id, days_before, year)
);

create index if not exists idx_reminder_log_birthday on public.birthday_reminder_log(birthday_id);

-- Solo il service role può leggere/scrivere questa tabella (usata solo dalla serverless function)
alter table public.birthday_reminder_log enable row level security;

create policy "Service role only"
  on public.birthday_reminder_log
  using (false);
