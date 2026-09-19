create table if not exists public.financial_month_closures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_key text not null,
  period_start date not null,
  period_end date not null,
  income numeric(15, 2) not null default 0,
  expenses numeric(15, 2) not null default 0,
  savings numeric(15, 2) not null default 0,
  savings_rate numeric(8, 2),
  account_net_worth numeric(15, 2) not null default 0,
  consolidated_net_worth numeric(15, 2) not null default 0,
  investment_value numeric(15, 2) not null default 0,
  transaction_count integer not null default 0,
  top_expense_category text,
  top_expense_amount numeric(15, 2) not null default 0,
  generated_insights jsonb not null default '[]'::jsonb,
  closed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_month_closures_period_format check (period_key ~ '^\d{4}-\d{2}$'),
  constraint financial_month_closures_dates check (period_end >= period_start),
  constraint financial_month_closures_unique_period unique (user_id, period_key)
);

create index if not exists financial_month_closures_user_period_idx
  on public.financial_month_closures(user_id, period_start desc);

drop trigger if exists set_updated_at_financial_month_closures on public.financial_month_closures;
create trigger set_updated_at_financial_month_closures
before update on public.financial_month_closures
for each row execute function public.set_updated_at();

alter table public.financial_month_closures enable row level security;

drop policy if exists "Users can view own financial month closures"
  on public.financial_month_closures;
create policy "Users can view own financial month closures"
  on public.financial_month_closures for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own financial month closures"
  on public.financial_month_closures;
create policy "Users can insert own financial month closures"
  on public.financial_month_closures for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own financial month closures"
  on public.financial_month_closures;
create policy "Users can update own financial month closures"
  on public.financial_month_closures for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.financial_month_closures from public;
grant select, insert, update on public.financial_month_closures to authenticated;
