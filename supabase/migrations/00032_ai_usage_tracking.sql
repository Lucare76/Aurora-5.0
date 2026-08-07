-- Sprint 32B: tracking utilizzo AI aggregato per utente.
-- Non salva prompt, risposte, evidenze finanziarie, API key o riferimenti contabili.

create extension if not exists pgcrypto;

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

create table if not exists public.ai_usage_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  model text not null,
  usage_date date not null,
  request_count integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  total_tokens bigint not null default 0,
  estimated_cost_usd numeric,
  last_request_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_usage_daily_unique unique (user_id, provider, model, usage_date),
  constraint ai_usage_daily_provider_check check (provider in ('OPENAI', 'ANTHROPIC', 'GEMINI')),
  constraint ai_usage_daily_non_negative_check check (
    request_count >= 0
    and input_tokens >= 0
    and output_tokens >= 0
    and total_tokens >= 0
    and (estimated_cost_usd is null or estimated_cost_usd >= 0)
  )
);

alter table public.ai_usage_daily
  add column if not exists provider text not null default 'OPENAI';
alter table public.ai_usage_daily
  add column if not exists model text not null default 'unknown';
alter table public.ai_usage_daily
  add column if not exists usage_date date not null default current_date;
alter table public.ai_usage_daily
  add column if not exists request_count integer not null default 0;
alter table public.ai_usage_daily
  add column if not exists input_tokens bigint not null default 0;
alter table public.ai_usage_daily
  add column if not exists output_tokens bigint not null default 0;
alter table public.ai_usage_daily
  add column if not exists total_tokens bigint not null default 0;
alter table public.ai_usage_daily
  add column if not exists estimated_cost_usd numeric;
alter table public.ai_usage_daily
  add column if not exists last_request_at timestamptz;
alter table public.ai_usage_daily
  add column if not exists created_at timestamptz not null default now();
alter table public.ai_usage_daily
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_usage_daily_unique'
      and conrelid = 'public.ai_usage_daily'::regclass
  ) then
    alter table public.ai_usage_daily
      add constraint ai_usage_daily_unique unique (user_id, provider, model, usage_date);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_usage_daily_provider_check'
      and conrelid = 'public.ai_usage_daily'::regclass
  ) then
    alter table public.ai_usage_daily
      add constraint ai_usage_daily_provider_check check (provider in ('OPENAI', 'ANTHROPIC', 'GEMINI'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_usage_daily_non_negative_check'
      and conrelid = 'public.ai_usage_daily'::regclass
  ) then
    alter table public.ai_usage_daily
      add constraint ai_usage_daily_non_negative_check check (
        request_count >= 0
        and input_tokens >= 0
        and output_tokens >= 0
        and total_tokens >= 0
        and (estimated_cost_usd is null or estimated_cost_usd >= 0)
      );
  end if;
end $$;

create index if not exists idx_ai_usage_daily_user_date
  on public.ai_usage_daily(user_id, usage_date desc);

alter table public.ai_usage_daily enable row level security;

drop policy if exists "ai_usage_daily_select_own" on public.ai_usage_daily;
create policy "ai_usage_daily_select_own"
on public.ai_usage_daily
for select
using ((select auth.uid()) = user_id);

drop policy if exists "ai_usage_daily_insert_own" on public.ai_usage_daily;
create policy "ai_usage_daily_insert_own"
on public.ai_usage_daily
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "ai_usage_daily_update_own" on public.ai_usage_daily;
create policy "ai_usage_daily_update_own"
on public.ai_usage_daily
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop trigger if exists set_updated_at_ai_usage_daily on public.ai_usage_daily;
create trigger set_updated_at_ai_usage_daily
before update on public.ai_usage_daily
for each row
execute function public.set_updated_at();

create or replace function public.increment_ai_usage_daily(
  p_user_id uuid,
  p_provider text,
  p_model text,
  p_usage_date date,
  p_input_tokens bigint,
  p_output_tokens bigint,
  p_total_tokens bigint,
  p_estimated_cost_usd numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'not authorized';
  end if;

  if p_provider not in ('OPENAI', 'ANTHROPIC', 'GEMINI') then
    raise exception 'invalid provider';
  end if;

  insert into public.ai_usage_daily (
    user_id,
    provider,
    model,
    usage_date,
    request_count,
    input_tokens,
    output_tokens,
    total_tokens,
    estimated_cost_usd,
    last_request_at
  )
  values (
    p_user_id,
    p_provider,
    p_model,
    p_usage_date,
    1,
    greatest(coalesce(p_input_tokens, 0), 0),
    greatest(coalesce(p_output_tokens, 0), 0),
    greatest(coalesce(p_total_tokens, 0), 0),
    p_estimated_cost_usd,
    now()
  )
  on conflict (user_id, provider, model, usage_date)
  do update set
    request_count = public.ai_usage_daily.request_count + 1,
    input_tokens = public.ai_usage_daily.input_tokens + excluded.input_tokens,
    output_tokens = public.ai_usage_daily.output_tokens + excluded.output_tokens,
    total_tokens = public.ai_usage_daily.total_tokens + excluded.total_tokens,
    estimated_cost_usd = case
      when public.ai_usage_daily.estimated_cost_usd is null or excluded.estimated_cost_usd is null then null
      else public.ai_usage_daily.estimated_cost_usd + excluded.estimated_cost_usd
    end,
    last_request_at = now(),
    updated_at = now();
end;
$$;

revoke all on public.ai_usage_daily from public;
grant select, insert, update on public.ai_usage_daily to authenticated;

revoke all on function public.increment_ai_usage_daily(uuid, text, text, date, bigint, bigint, bigint, numeric) from public;
grant execute on function public.increment_ai_usage_daily(uuid, text, text, date, bigint, bigint, bigint, numeric) to authenticated;
