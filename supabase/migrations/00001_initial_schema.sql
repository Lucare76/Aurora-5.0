-- Aurora 5.0 — Initial Schema
-- All tables use UUID primary keys and reference auth.users(id).
-- RLS is enabled on every table with per-user isolation policies.

-- ============================================================
-- 1. PROFILES
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url  text,
  currency    text not null default 'EUR',
  locale      text not null default 'it-IT',
  timezone    text not null default 'Europe/Rome',
  onboarding_done boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. ACCOUNTS
-- ============================================================
create table if not exists public.accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  type        text not null default 'checking',
  color       text,
  icon        text,
  balance     numeric(15, 2) not null default 0,
  currency    text not null default 'EUR',
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_accounts_user on public.accounts(user_id);

alter table public.accounts enable row level security;

create policy "Users can view own accounts"
  on public.accounts for select
  using (auth.uid() = user_id);

create policy "Users can insert own accounts"
  on public.accounts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own accounts"
  on public.accounts for update
  using (auth.uid() = user_id);

create policy "Users can delete own accounts"
  on public.accounts for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 3. CATEGORIES
-- ============================================================
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  type        text not null default 'expense',
  color       text,
  icon        text,
  parent_id   uuid references public.categories(id) on delete set null,
  is_default  boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_categories_user on public.categories(user_id);

alter table public.categories enable row level security;

create policy "Users can view own categories"
  on public.categories for select
  using (auth.uid() = user_id);

create policy "Users can insert own categories"
  on public.categories for insert
  with check (auth.uid() = user_id);

create policy "Users can update own categories"
  on public.categories for update
  using (auth.uid() = user_id);

create policy "Users can delete own categories"
  on public.categories for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 4. TRANSACTIONS
-- ============================================================
create table if not exists public.transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  account_id      uuid not null references public.accounts(id) on delete cascade,
  category_id     uuid references public.categories(id) on delete set null,
  type            text not null,
  amount          numeric(15, 2) not null,
  description     text,
  notes           text,
  date            date not null,
  transfer_peer_id uuid references public.accounts(id) on delete set null,
  recurring_id    uuid,
  receipt_url     text,
  receipt_data    jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_transactions_user on public.transactions(user_id);
create index if not exists idx_transactions_account on public.transactions(account_id);
create index if not exists idx_transactions_date on public.transactions(date desc);

alter table public.transactions enable row level security;

create policy "Users can view own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own transactions"
  on public.transactions for update
  using (auth.uid() = user_id);

create policy "Users can delete own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 5. RECURRING RULES
-- ============================================================
create table if not exists public.recurring_rules (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  account_id      uuid not null references public.accounts(id) on delete cascade,
  category_id     uuid references public.categories(id) on delete set null,
  type            text not null,
  amount          numeric(15, 2) not null,
  description     text not null,
  frequency       text not null,
  start_date      date not null,
  end_date        date,
  next_due_date   date not null,
  last_run_date   date,
  is_active       boolean not null default true,
  auto_create     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_recurring_user on public.recurring_rules(user_id);

alter table public.recurring_rules enable row level security;

create policy "Users can view own recurring rules"
  on public.recurring_rules for select
  using (auth.uid() = user_id);

create policy "Users can insert own recurring rules"
  on public.recurring_rules for insert
  with check (auth.uid() = user_id);

create policy "Users can update own recurring rules"
  on public.recurring_rules for update
  using (auth.uid() = user_id);

create policy "Users can delete own recurring rules"
  on public.recurring_rules for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 6. BUDGETS
-- ============================================================
create table if not exists public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  amount      numeric(15, 2) not null,
  month       int not null,
  year        int not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, category_id, month, year)
);

create index if not exists idx_budgets_user on public.budgets(user_id);

alter table public.budgets enable row level security;

create policy "Users can view own budgets"
  on public.budgets for select
  using (auth.uid() = user_id);

create policy "Users can insert own budgets"
  on public.budgets for insert
  with check (auth.uid() = user_id);

create policy "Users can update own budgets"
  on public.budgets for update
  using (auth.uid() = user_id);

create policy "Users can delete own budgets"
  on public.budgets for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 7. LOANS
-- ============================================================
create table if not exists public.loans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  counterpart text not null,
  type        text not null,
  amount      numeric(15, 2) not null,
  remaining   numeric(15, 2) not null,
  description text,
  due_date    date,
  is_settled  boolean not null default false,
  settled_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_loans_user on public.loans(user_id);

alter table public.loans enable row level security;

create policy "Users can view own loans"
  on public.loans for select
  using (auth.uid() = user_id);

create policy "Users can insert own loans"
  on public.loans for insert
  with check (auth.uid() = user_id);

create policy "Users can update own loans"
  on public.loans for update
  using (auth.uid() = user_id);

create policy "Users can delete own loans"
  on public.loans for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 8. LOAN PAYMENTS
-- ============================================================
create table if not exists public.loan_payments (
  id          uuid primary key default gen_random_uuid(),
  loan_id     uuid not null references public.loans(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount      numeric(15, 2) not null,
  paid_at     timestamptz not null default now(),
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_loan_payments_loan on public.loan_payments(loan_id);

alter table public.loan_payments enable row level security;

create policy "Users can view own loan payments"
  on public.loan_payments for select
  using (auth.uid() = user_id);

create policy "Users can insert own loan payments"
  on public.loan_payments for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- 9. BIRTHDAYS
-- ============================================================
create table if not exists public.birthdays (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  birth_date    date not null,
  reminder_days int[] not null default '{7}',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_birthdays_user on public.birthdays(user_id);

alter table public.birthdays enable row level security;

create policy "Users can view own birthdays"
  on public.birthdays for select
  using (auth.uid() = user_id);

create policy "Users can insert own birthdays"
  on public.birthdays for insert
  with check (auth.uid() = user_id);

create policy "Users can update own birthdays"
  on public.birthdays for update
  using (auth.uid() = user_id);

create policy "Users can delete own birthdays"
  on public.birthdays for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 10. AUDIT LOGS
-- ============================================================
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  action      text not null,
  table_name  text not null,
  record_id   uuid,
  old_data    jsonb,
  new_data    jsonb,
  ip_address  inet,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_user on public.audit_logs(user_id);
create index if not exists idx_audit_created on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;

create policy "Users can view own audit logs"
  on public.audit_logs for select
  using (auth.uid() = user_id);

-- ============================================================
-- 11. RPC FUNCTIONS
-- ============================================================

-- Atomically adjust account balance
-- DROP first to handle parameter rename from p_delta to p_amount
drop function if exists public.adjust_account_balance(uuid, numeric);

create or replace function public.adjust_account_balance(
  p_account_id uuid,
  p_amount numeric
)
returns void
language plpgsql
security definer
as $$
begin
  update public.accounts
  set balance = balance + p_amount,
      updated_at = now()
  where id = p_account_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Account not found or not owned by user';
  end if;
end;
$$;

-- Create default categories for new user
create or replace function public.create_default_categories(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Income categories
  insert into public.categories (user_id, name, type, icon, is_default, sort_order) values
    (p_user_id, 'Stipendio',       'income',  '💰', true, 1),
    (p_user_id, 'Freelance',       'income',  '💻', true, 2),
    (p_user_id, 'Investimenti',    'income',  '📈', true, 3),
    (p_user_id, 'Altro (entrata)', 'income',  '📥', true, 4);

  -- Expense categories
  insert into public.categories (user_id, name, type, icon, is_default, sort_order) values
    (p_user_id, 'Casa',            'expense', '🏠', true, 1),
    (p_user_id, 'Alimentari',      'expense', '🛒', true, 2),
    (p_user_id, 'Trasporti',       'expense', '🚗', true, 3),
    (p_user_id, 'Salute',          'expense', '🏥', true, 4),
    (p_user_id, 'Svago',           'expense', '🎮', true, 5),
    (p_user_id, 'Abbonamenti',     'expense', '📱', true, 6),
    (p_user_id, 'Istruzione',      'expense', '📚', true, 7),
    (p_user_id, 'Vestiti',         'expense', '👕', true, 8),
    (p_user_id, 'Ristoranti',      'expense', '🍽️', true, 9),
    (p_user_id, 'Altro (uscita)',  'expense', '📤', true, 10);
end;
$$;

-- Updated at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply updated_at trigger to relevant tables
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.recurring_rules
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.budgets
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.loans
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.birthdays
  for each row execute function public.set_updated_at();
