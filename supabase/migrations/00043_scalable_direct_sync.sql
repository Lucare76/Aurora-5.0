-- Direct read-only Scalable MCP connection for Aurora.
-- OAuth tokens are encrypted by the application before storage.

alter table public.external_assets
  add column if not exists external_key text;

create unique index if not exists idx_external_assets_user_source_key
  on public.external_assets(user_id, source_type, external_key)
  where external_key is not null;

create table if not exists public.scalable_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  client_id text not null,
  access_token_enc text not null,
  refresh_token_enc text,
  token_type text not null default 'Bearer',
  scope text,
  expires_at timestamptz,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scalable_connections enable row level security;

create policy "Users can view own scalable connection"
  on public.scalable_connections for select
  using (auth.uid() = user_id);

create policy "Users can insert own scalable connection"
  on public.scalable_connections for insert
  with check (auth.uid() = user_id);

create policy "Users can update own scalable connection"
  on public.scalable_connections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own scalable connection"
  on public.scalable_connections for delete
  using (auth.uid() = user_id);

drop trigger if exists set_updated_at_scalable_connections on public.scalable_connections;
create trigger set_updated_at_scalable_connections
  before update on public.scalable_connections
  for each row execute function public.set_updated_at();
