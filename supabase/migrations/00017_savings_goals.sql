-- Sprint 8A: Savings Goals
-- Independent savings-goal tracking. Contributions never mutate account balances.

create table if not exists public.savings_goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  target_amount  numeric(15, 2) not null,
  current_amount numeric(15, 2) not null default 0,
  target_date    date,
  icon           text,
  color          text,
  notes          text,
  status         text not null default 'ACTIVE',
  archived       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint savings_goals_target_amount_positive check (target_amount > 0),
  constraint savings_goals_current_amount_non_negative check (current_amount >= 0),
  constraint savings_goals_status_valid check (status in ('ACTIVE', 'COMPLETED', 'ARCHIVED'))
);

create table if not exists public.goal_contributions (
  id         uuid primary key default gen_random_uuid(),
  goal_id    uuid not null references public.savings_goals(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  amount     numeric(15, 2) not null,
  date       date not null default current_date,
  note       text,
  created_at timestamptz not null default now(),
  constraint goal_contributions_amount_positive check (amount > 0)
);

create index if not exists idx_savings_goals_user_status
  on public.savings_goals (user_id, status, archived, target_date);

create index if not exists idx_goal_contributions_goal_date
  on public.goal_contributions (goal_id, date desc, created_at desc);

create index if not exists idx_goal_contributions_user
  on public.goal_contributions (user_id);

alter table public.savings_goals enable row level security;
alter table public.goal_contributions enable row level security;

create policy "Users can view own savings goals"
  on public.savings_goals for select
  using (auth.uid() = user_id);

create policy "Users can insert own savings goals"
  on public.savings_goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own savings goals"
  on public.savings_goals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own savings goals"
  on public.savings_goals for delete
  using (auth.uid() = user_id);

create policy "Users can view own goal contributions"
  on public.goal_contributions for select
  using (auth.uid() = user_id);

create policy "Users can insert own goal contributions"
  on public.goal_contributions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.savings_goals g
      where g.id = goal_id
        and g.user_id = auth.uid()
    )
  );

create policy "Users can delete own goal contributions"
  on public.goal_contributions for delete
  using (auth.uid() = user_id);

create or replace function public.set_savings_goal_status()
returns trigger
language plpgsql
as $$
begin
  if new.archived then
    new.status := 'ARCHIVED';
  elsif new.current_amount >= new.target_amount then
    new.status := 'COMPLETED';
  elsif new.status = 'ARCHIVED' then
    new.status := 'ACTIVE';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_savings_goal_status on public.savings_goals;
create trigger set_savings_goal_status
  before insert or update on public.savings_goals
  for each row execute function public.set_savings_goal_status();

create or replace function public.apply_goal_contribution_delta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_goal_user_id uuid;
begin
  if tg_op = 'INSERT' then
    select user_id into v_goal_user_id
    from public.savings_goals
    where id = new.goal_id
    for update;

    if v_goal_user_id is null or v_goal_user_id <> new.user_id then
      raise exception 'GOAL_NOT_FOUND';
    end if;

    update public.savings_goals
    set current_amount = current_amount + new.amount
    where id = new.goal_id
      and user_id = new.user_id;

    return new;
  elsif tg_op = 'DELETE' then
    select user_id into v_goal_user_id
    from public.savings_goals
    where id = old.goal_id
    for update;

    if v_goal_user_id is null or v_goal_user_id <> old.user_id then
      raise exception 'GOAL_NOT_FOUND';
    end if;

    update public.savings_goals
    set current_amount = greatest(0, current_amount - old.amount)
    where id = old.goal_id
      and user_id = old.user_id;

    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists apply_goal_contribution_insert on public.goal_contributions;
create trigger apply_goal_contribution_insert
  after insert on public.goal_contributions
  for each row execute function public.apply_goal_contribution_delta();

drop trigger if exists apply_goal_contribution_delete on public.goal_contributions;
create trigger apply_goal_contribution_delete
  after delete on public.goal_contributions
  for each row execute function public.apply_goal_contribution_delta();
