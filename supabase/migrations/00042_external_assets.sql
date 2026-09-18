-- Consolidated net worth: external investments/assets not already represented by Aurora accounts.
-- These records are intentionally read-only from an accounting perspective:
-- they do not create transactions and do not mutate account balances.

create table if not exists public.external_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  provider text,
  asset_type text not null default 'investment'
    check (asset_type in ('investment', 'cash', 'pension', 'other')),
  instrument text,
  invested_amount numeric(15,2) not null default 0 check (invested_amount >= 0),
  current_value numeric(15,2) not null default 0 check (current_value >= 0),
  currency text not null default 'EUR',
  source_type text not null default 'MANUAL'
    check (source_type in ('MANUAL', 'SCALABLE', 'SCREENSHOT')),
  include_in_net_worth boolean not null default true,
  notes text,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_external_assets_user
  on public.external_assets(user_id);

create index if not exists idx_external_assets_user_include
  on public.external_assets(user_id, include_in_net_worth);

alter table public.external_assets enable row level security;

create policy "Users can view own external assets"
  on public.external_assets for select
  using (auth.uid() = user_id);

create policy "Users can insert own external assets"
  on public.external_assets for insert
  with check (auth.uid() = user_id);

create policy "Users can update own external assets"
  on public.external_assets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own external assets"
  on public.external_assets for delete
  using (auth.uid() = user_id);

drop trigger if exists set_updated_at_external_assets on public.external_assets;
create trigger set_updated_at_external_assets
  before update on public.external_assets
  for each row execute function public.set_updated_at();
