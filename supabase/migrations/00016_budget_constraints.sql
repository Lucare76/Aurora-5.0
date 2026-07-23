-- Sprint 7A: add CHECK constraints and performance index to existing budgets table.
-- The table and RLS already exist (migration 00001).

alter table public.budgets
  add constraint budgets_amount_positive
    check (amount > 0),
  add constraint budgets_month_range
    check (month between 1 and 12),
  add constraint budgets_year_range
    check (year between 2000 and 2100);

-- Fast listing for GET /api/budgets?year=&month=
create index if not exists idx_budgets_user_year_month
  on public.budgets (user_id, year, month);
