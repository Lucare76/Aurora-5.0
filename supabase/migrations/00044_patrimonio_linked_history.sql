-- Link externally-synced investments to the Aurora accounts that already contain their capital.
-- Also keep immutable market-value snapshots so 7/30 day changes can be shown without
-- mutating accounting balances or transactions.

alter table public.external_assets
  add column if not exists linked_account_id uuid references public.accounts(id) on delete set null;

create index if not exists idx_external_assets_linked_account
  on public.external_assets(user_id, linked_account_id);

create table if not exists public.external_asset_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null references public.external_assets(id) on delete cascade,
  current_value numeric(15,2) not null check (current_value >= 0),
  linked_account_balance numeric(15,2),
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_external_asset_snapshots_asset_observed
  on public.external_asset_snapshots(asset_id, observed_at desc);

create index if not exists idx_external_asset_snapshots_user_observed
  on public.external_asset_snapshots(user_id, observed_at desc);

alter table public.external_asset_snapshots enable row level security;

create policy "Users can view own external asset snapshots"
  on public.external_asset_snapshots for select
  using (auth.uid() = user_id);

create policy "Users can insert own external asset snapshots"
  on public.external_asset_snapshots for insert
  with check (auth.uid() = user_id);

create table if not exists public.patrimonio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  base_net_worth numeric(15,2) not null,
  net_worth_adjustment numeric(15,2) not null,
  consolidated_value numeric(15,2) not null,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_patrimonio_snapshots_user_observed
  on public.patrimonio_snapshots(user_id, observed_at desc);

alter table public.patrimonio_snapshots enable row level security;

create policy "Users can view own patrimonio snapshots"
  on public.patrimonio_snapshots for select
  using (auth.uid() = user_id);

create policy "Users can insert own patrimonio snapshots"
  on public.patrimonio_snapshots for insert
  with check (auth.uid() = user_id);
