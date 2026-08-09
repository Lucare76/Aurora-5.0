create table if not exists public.personal_deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'OTHER',
  due_date date not null,
  status text not null default 'ACTIVE',
  priority text not null default 'NORMAL',
  recurrence text not null default 'NONE',
  reminder_days_before integer not null default 7,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_deadlines_title_not_blank check (length(trim(title)) > 0),
  constraint personal_deadlines_category_check check (category in ('VEHICLE', 'DOCUMENT', 'HEALTH', 'FAMILY', 'SCHOOL', 'SUBSCRIPTION', 'ADMINISTRATIVE', 'OTHER')),
  constraint personal_deadlines_status_check check (status in ('ACTIVE', 'COMPLETED', 'CANCELLED')),
  constraint personal_deadlines_priority_check check (priority in ('LOW', 'NORMAL', 'HIGH')),
  constraint personal_deadlines_recurrence_check check (recurrence in ('NONE', 'MONTHLY', 'YEARLY')),
  constraint personal_deadlines_reminder_check check (reminder_days_before in (0, 1, 3, 7, 15, 30)),
  constraint personal_deadlines_completed_at_check check (
    (status = 'COMPLETED' and completed_at is not null)
    or
    (status <> 'COMPLETED' and completed_at is null)
  )
);

alter table public.personal_deadlines
  add column if not exists description text;
alter table public.personal_deadlines
  add column if not exists category text not null default 'OTHER';
alter table public.personal_deadlines
  add column if not exists status text not null default 'ACTIVE';
alter table public.personal_deadlines
  add column if not exists priority text not null default 'NORMAL';
alter table public.personal_deadlines
  add column if not exists recurrence text not null default 'NONE';
alter table public.personal_deadlines
  add column if not exists reminder_days_before integer not null default 7;
alter table public.personal_deadlines
  add column if not exists completed_at timestamptz;
alter table public.personal_deadlines
  add column if not exists created_at timestamptz not null default now();
alter table public.personal_deadlines
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_personal_deadlines_user_due_date
  on public.personal_deadlines(user_id, due_date);

create index if not exists idx_personal_deadlines_user_status
  on public.personal_deadlines(user_id, status);

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

drop trigger if exists set_updated_at_personal_deadlines on public.personal_deadlines;
create trigger set_updated_at_personal_deadlines
before update on public.personal_deadlines
for each row
execute function public.set_updated_at();

alter table public.personal_deadlines enable row level security;

drop policy if exists "personal_deadlines_select_own" on public.personal_deadlines;
create policy "personal_deadlines_select_own"
on public.personal_deadlines
for select
using ((select auth.uid()) = user_id);

drop policy if exists "personal_deadlines_insert_own" on public.personal_deadlines;
create policy "personal_deadlines_insert_own"
on public.personal_deadlines
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "personal_deadlines_update_own" on public.personal_deadlines;
create policy "personal_deadlines_update_own"
on public.personal_deadlines
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "personal_deadlines_delete_own" on public.personal_deadlines;
create policy "personal_deadlines_delete_own"
on public.personal_deadlines
for delete
using ((select auth.uid()) = user_id);

revoke all on public.personal_deadlines from public;
grant select, insert, update, delete on public.personal_deadlines to authenticated;
