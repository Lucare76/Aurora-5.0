-- Migration 00041: linked goal sources and read-only snapshots
--
-- Goal-linked sources let Aurora include external assets (for example a Scalable
-- position) in an objective without mutating account balances or creating
-- financial transactions. Values are represented as immutable snapshots.

create table if not exists public.goal_linked_sources (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  goal_id         uuid not null references public.savings_goals(id) on delete cascade,
  provider        text not null,
  source_type     text not null,
  external_key    text not null,
  display_name    text not null,
  currency        text not null default 'EUR',
  include_in_goal boolean not null default true,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint goal_linked_sources_provider_valid check (provider in ('SCALABLE', 'MANUAL')),
  constraint goal_linked_sources_type_valid check (source_type in ('POSITION', 'CASH', 'PORTFOLIO')),
  constraint goal_linked_sources_currency_length check (char_length(currency) between 3 and 8),
  constraint goal_linked_sources_unique unique (user_id, goal_id, provider, external_key)
);

create table if not exists public.goal_source_snapshots (
  id                  uuid primary key default gen_random_uuid(),
  source_id           uuid not null references public.goal_linked_sources(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  value               numeric(15,2) not null,
  quantity            numeric(24,8),
  unit_price          numeric(15,6),
  monthly_plan_amount numeric(15,2),
  next_plan_date      date,
  observed_at         timestamptz not null default now(),
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  constraint goal_source_snapshots_value_non_negative check (value >= 0),
  constraint goal_source_snapshots_quantity_non_negative check (quantity is null or quantity >= 0),
  constraint goal_source_snapshots_price_non_negative check (unit_price is null or unit_price >= 0),
  constraint goal_source_snapshots_plan_non_negative check (monthly_plan_amount is null or monthly_plan_amount >= 0)
);

create index if not exists idx_goal_linked_sources_goal
  on public.goal_linked_sources (goal_id, include_in_goal);

create index if not exists idx_goal_source_snapshots_source_observed
  on public.goal_source_snapshots (source_id, observed_at desc, created_at desc);

alter table public.goal_linked_sources enable row level security;
alter table public.goal_source_snapshots enable row level security;

create policy "Users can view own linked goal sources"
  on public.goal_linked_sources for select
  using (auth.uid() = user_id);

create policy "Users can insert own linked goal sources"
  on public.goal_linked_sources for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.savings_goals g
      where g.id = goal_id and g.user_id = auth.uid()
    )
  );

create policy "Users can update own linked goal sources"
  on public.goal_linked_sources for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.savings_goals g
      where g.id = goal_id and g.user_id = auth.uid()
    )
  );

create policy "Users can delete own linked goal sources"
  on public.goal_linked_sources for delete
  using (auth.uid() = user_id);

create policy "Users can view own goal source snapshots"
  on public.goal_source_snapshots for select
  using (auth.uid() = user_id);

create policy "Users can insert own goal source snapshots"
  on public.goal_source_snapshots for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.goal_linked_sources s
      where s.id = source_id and s.user_id = auth.uid()
    )
  );

create policy "Users can delete own goal source snapshots"
  on public.goal_source_snapshots for delete
  using (auth.uid() = user_id);

create or replace function public.upsert_goal_linked_source_snapshot(
  p_goal_id uuid,
  p_provider text,
  p_source_type text,
  p_external_key text,
  p_display_name text,
  p_currency text,
  p_value numeric,
  p_quantity numeric default null,
  p_unit_price numeric default null,
  p_monthly_plan_amount numeric default null,
  p_next_plan_date date default null,
  p_observed_at timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_source public.goal_linked_sources%rowtype;
  v_snapshot public.goal_source_snapshots%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.savings_goals g
    where g.id = p_goal_id and g.user_id = v_uid
  ) then
    raise exception 'Goal not found';
  end if;

  if p_provider not in ('SCALABLE', 'MANUAL') then
    raise exception 'Invalid provider';
  end if;
  if p_source_type not in ('POSITION', 'CASH', 'PORTFOLIO') then
    raise exception 'Invalid source type';
  end if;
  if coalesce(trim(p_external_key), '') = '' or coalesce(trim(p_display_name), '') = '' then
    raise exception 'Source identity required';
  end if;
  if p_value is null or p_value < 0 then
    raise exception 'Snapshot value must be non-negative';
  end if;
  if p_monthly_plan_amount is not null and p_monthly_plan_amount < 0 then
    raise exception 'Monthly plan amount must be non-negative';
  end if;

  insert into public.goal_linked_sources (
    user_id, goal_id, provider, source_type, external_key, display_name, currency, metadata
  )
  values (
    v_uid, p_goal_id, p_provider, p_source_type, trim(p_external_key), trim(p_display_name),
    upper(coalesce(nullif(trim(p_currency), ''), 'EUR')), coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (user_id, goal_id, provider, external_key)
  do update set
    source_type = excluded.source_type,
    display_name = excluded.display_name,
    currency = excluded.currency,
    metadata = excluded.metadata,
    updated_at = now()
  returning * into v_source;

  insert into public.goal_source_snapshots (
    source_id, user_id, value, quantity, unit_price, monthly_plan_amount,
    next_plan_date, observed_at, metadata
  )
  values (
    v_source.id, v_uid, p_value, p_quantity, p_unit_price, p_monthly_plan_amount,
    p_next_plan_date, coalesce(p_observed_at, now()), coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_snapshot;

  return jsonb_build_object(
    'source_id', v_source.id,
    'snapshot_id', v_snapshot.id
  );
end;
$$;

revoke all on function public.upsert_goal_linked_source_snapshot(
  uuid, text, text, text, text, text, numeric, numeric, numeric, numeric, date, timestamptz, jsonb
) from public;
grant execute on function public.upsert_goal_linked_source_snapshot(
  uuid, text, text, text, text, text, numeric, numeric, numeric, numeric, date, timestamptz, jsonb
) to authenticated;
