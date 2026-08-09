create table if not exists public.personal_timeline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null,
  end_date date,
  title text not null,
  description text,
  category text not null,
  subject text not null,
  location text,
  provider text,
  tags text[] not null default '{}',
  importance text not null default 'NORMAL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_timeline_title_not_blank check (length(trim(title)) > 0),
  constraint personal_timeline_category_check check (category in ('HEALTH', 'THERAPY', 'SCHOOL', 'DOCUMENT', 'ADMINISTRATIVE', 'TRAVEL', 'FAMILY', 'MILESTONE', 'OTHER')),
  constraint personal_timeline_subject_check check (subject in ('SELF', 'AURORA', 'ILENIA', 'FAMILY')),
  constraint personal_timeline_importance_check check (importance in ('LOW', 'NORMAL', 'HIGH')),
  constraint personal_timeline_date_range_check check (end_date is null or end_date >= event_date)
);

alter table public.personal_timeline_events
  add column if not exists event_date date;
alter table public.personal_timeline_events
  add column if not exists end_date date;
alter table public.personal_timeline_events
  add column if not exists title text;
alter table public.personal_timeline_events
  add column if not exists description text;
alter table public.personal_timeline_events
  add column if not exists category text;
alter table public.personal_timeline_events
  add column if not exists subject text;
alter table public.personal_timeline_events
  add column if not exists location text;
alter table public.personal_timeline_events
  add column if not exists provider text;
alter table public.personal_timeline_events
  add column if not exists tags text[] not null default '{}';
alter table public.personal_timeline_events
  add column if not exists importance text not null default 'NORMAL';
alter table public.personal_timeline_events
  add column if not exists created_at timestamptz not null default now();
alter table public.personal_timeline_events
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'personal_timeline_title_not_blank'
      and conrelid = 'public.personal_timeline_events'::regclass
  ) then
    alter table public.personal_timeline_events
      add constraint personal_timeline_title_not_blank check (length(trim(title)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'personal_timeline_category_check'
      and conrelid = 'public.personal_timeline_events'::regclass
  ) then
    alter table public.personal_timeline_events
      add constraint personal_timeline_category_check check (category in ('HEALTH', 'THERAPY', 'SCHOOL', 'DOCUMENT', 'ADMINISTRATIVE', 'TRAVEL', 'FAMILY', 'MILESTONE', 'OTHER'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'personal_timeline_subject_check'
      and conrelid = 'public.personal_timeline_events'::regclass
  ) then
    alter table public.personal_timeline_events
      add constraint personal_timeline_subject_check check (subject in ('SELF', 'AURORA', 'ILENIA', 'FAMILY'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'personal_timeline_importance_check'
      and conrelid = 'public.personal_timeline_events'::regclass
  ) then
    alter table public.personal_timeline_events
      add constraint personal_timeline_importance_check check (importance in ('LOW', 'NORMAL', 'HIGH'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'personal_timeline_date_range_check'
      and conrelid = 'public.personal_timeline_events'::regclass
  ) then
    alter table public.personal_timeline_events
      add constraint personal_timeline_date_range_check check (end_date is null or end_date >= event_date);
  end if;
end $$;

create index if not exists idx_personal_timeline_events_user_event_date
  on public.personal_timeline_events(user_id, event_date desc, created_at desc);

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

drop trigger if exists set_updated_at_personal_timeline_events on public.personal_timeline_events;
create trigger set_updated_at_personal_timeline_events
before update on public.personal_timeline_events
for each row
execute function public.set_updated_at();

alter table public.personal_timeline_events enable row level security;

drop policy if exists "personal_timeline_events_select_own" on public.personal_timeline_events;
create policy "personal_timeline_events_select_own"
on public.personal_timeline_events
for select
using ((select auth.uid()) = user_id);

drop policy if exists "personal_timeline_events_insert_own" on public.personal_timeline_events;
create policy "personal_timeline_events_insert_own"
on public.personal_timeline_events
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "personal_timeline_events_update_own" on public.personal_timeline_events;
create policy "personal_timeline_events_update_own"
on public.personal_timeline_events
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "personal_timeline_events_delete_own" on public.personal_timeline_events;
create policy "personal_timeline_events_delete_own"
on public.personal_timeline_events
for delete
using ((select auth.uid()) = user_id);

revoke all on public.personal_timeline_events from public;
grant select, insert, update, delete on public.personal_timeline_events to authenticated;
