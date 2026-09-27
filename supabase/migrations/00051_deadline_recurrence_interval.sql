alter table public.personal_deadlines
  add column if not exists recurrence_interval integer not null default 1;

alter table public.personal_deadlines
  add constraint personal_deadlines_recurrence_interval_check
  check (recurrence_interval between 1 and 120);
