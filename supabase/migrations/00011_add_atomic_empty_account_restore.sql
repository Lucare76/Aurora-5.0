-- Backup Sprint 5: restore atomico Aurora Backup v1 solo su account vuoto.

create extension if not exists pgcrypto;

create table if not exists public.backup_restore_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  backup_checksum text not null,
  schema_version int not null,
  mode text not null,
  readiness text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint backup_restore_tokens_mode_check check (mode = 'empty_account_restore'),
  constraint backup_restore_tokens_readiness_check check (readiness = 'ready')
);

create index if not exists idx_backup_restore_tokens_user on public.backup_restore_tokens(user_id);
create index if not exists idx_backup_restore_tokens_expires on public.backup_restore_tokens(expires_at);

alter table public.backup_restore_tokens enable row level security;

create policy "Users can view own backup restore tokens"
  on public.backup_restore_tokens for select
  using (auth.uid() = user_id);

create policy "Users can create own backup restore tokens"
  on public.backup_restore_tokens for insert
  with check (auth.uid() = user_id);

create table if not exists public.backup_restore_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_id uuid references public.backup_restore_tokens(id) on delete set null,
  backup_checksum text not null,
  schema_version int not null,
  mode text not null,
  status text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  counts jsonb not null default '{}'::jsonb,
  error_code text,
  app_version text
);

create index if not exists idx_backup_restore_runs_user on public.backup_restore_runs(user_id);

alter table public.backup_restore_runs enable row level security;

create policy "Users can view own backup restore runs"
  on public.backup_restore_runs for select
  using (auth.uid() = user_id);

create or replace function public.restore_aurora_backup_v1_empty_account(
  p_token_id uuid,
  p_token text,
  p_backup jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_token public.backup_restore_tokens%rowtype;
  v_run_id uuid := gen_random_uuid();
  v_counts jsonb := '{}'::jsonb;
  v_checksum text := p_backup #>> '{integrity,checksum}';
  v_schema_version int := coalesce((p_backup ->> 'schemaVersion')::int, 0);
  v_now timestamptz := now();
  v_accounts int := jsonb_array_length(coalesce(p_backup #> '{data,accounts}', '[]'::jsonb));
  v_categories int := jsonb_array_length(coalesce(p_backup #> '{data,categories}', '[]'::jsonb));
  v_transactions int := jsonb_array_length(coalesce(p_backup #> '{data,transactions}', '[]'::jsonb));
  v_budgets int := jsonb_array_length(coalesce(p_backup #> '{data,budgets}', '[]'::jsonb));
  v_recurring int := jsonb_array_length(coalesce(p_backup #> '{data,recurringRules}', '[]'::jsonb));
  v_loans int := jsonb_array_length(coalesce(p_backup #> '{data,loans}', '[]'::jsonb));
  v_loan_payments int := jsonb_array_length(coalesce(p_backup #> '{data,loanPayments}', '[]'::jsonb));
  v_birthdays int := jsonb_array_length(coalesce(p_backup #> '{data,birthdays}', '[]'::jsonb));
  v_birthday_logs int := jsonb_array_length(coalesce(p_backup #> '{data,birthdayReminderLog}', '[]'::jsonb));
  v_audit_logs int := jsonb_array_length(coalesce(p_backup #> '{data,auditLogs}', '[]'::jsonb));
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_backup ->> 'format' <> 'aurora-backup' or v_schema_version <> 1 then
    raise exception 'INVALID_BACKUP';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 20260717));

  select *
    into v_token
    from public.backup_restore_tokens
   where id = p_token_id
     and user_id = v_uid
     and token_hash = encode(digest(p_token, 'sha256'), 'hex')
     and backup_checksum = v_checksum
     and schema_version = 1
     and mode = 'empty_account_restore'
     and readiness = 'ready'
     and used_at is null
     and expires_at > v_now
   for update;

  if not found then
    raise exception 'TOKEN_INVALID';
  end if;

  update public.backup_restore_tokens
     set used_at = v_now
   where id = v_token.id
     and used_at is null;

  if not found then
    raise exception 'TOKEN_ALREADY_USED';
  end if;

  if exists (select 1 from public.accounts where user_id = v_uid)
    or exists (select 1 from public.transactions where user_id = v_uid)
    or exists (select 1 from public.budgets where user_id = v_uid)
    or exists (select 1 from public.recurring_rules where user_id = v_uid)
    or exists (select 1 from public.loans where user_id = v_uid)
    or exists (select 1 from public.loan_payments where user_id = v_uid)
    or exists (select 1 from public.birthdays where user_id = v_uid)
    or exists (select 1 from public.categories where user_id = v_uid and is_default is not true)
  then
    raise exception 'ACCOUNT_NOT_EMPTY';
  end if;

  -- In modalita account vuoto le categorie default generate automaticamente
  -- sono considerate tecniche. Le rimuoviamo con regola stretta, dopo aver
  -- verificato che non esistano dati contabili o categorie utente.
  delete from public.categories
   where user_id = v_uid
     and is_default is true
     and parent_id is not null;

  delete from public.categories
   where user_id = v_uid
     and is_default is true
     and parent_id is null;

  insert into public.backup_restore_runs (
    id, user_id, token_id, backup_checksum, schema_version, mode, status, app_version
  )
  values (
    v_run_id, v_uid, v_token.id, v_checksum, 1, 'empty_account_restore', 'running', p_backup ->> 'appVersion'
  );

  insert into public.profiles (
    id, display_name, avatar_url, currency, locale, timezone, onboarding_done, created_at, updated_at
  )
  values (
    v_uid,
    nullif(p_backup #>> '{data,profile,display_name}', ''),
    nullif(p_backup #>> '{data,profile,avatar_url}', ''),
    coalesce(p_backup #>> '{data,profile,currency}', 'EUR'),
    coalesce(p_backup #>> '{data,profile,locale}', 'it-IT'),
    coalesce(p_backup #>> '{data,profile,timezone}', 'Europe/Rome'),
    coalesce((p_backup #>> '{data,profile,onboarding_done}')::boolean, false),
    coalesce((p_backup #>> '{data,profile,created_at}')::timestamptz, now()),
    coalesce((p_backup #>> '{data,profile,updated_at}')::timestamptz, now())
  )
  on conflict (id) do update
    set display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        currency = excluded.currency,
        locale = excluded.locale,
        timezone = excluded.timezone,
        onboarding_done = excluded.onboarding_done,
        updated_at = excluded.updated_at;

  insert into public.accounts (
    id, user_id, name, type, color, icon, balance, currency, is_active, is_hidden, sort_order, created_at, updated_at
  )
  select id, v_uid, name, coalesce(type, 'checking'), color, icon, coalesce(balance, 0), coalesce(currency, 'EUR'),
         coalesce(is_active, true), coalesce(is_hidden, false), coalesce(sort_order, 0),
         coalesce(created_at, now()), coalesce(updated_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,accounts}', '[]'::jsonb)) as x(
    id uuid, name text, type text, color text, icon text, balance numeric, currency text,
    is_active boolean, is_hidden boolean, sort_order int, created_at timestamptz, updated_at timestamptz
  );

  insert into public.categories (
    id, user_id, name, type, color, icon, parent_id, is_default, sort_order, created_at
  )
  select id, v_uid, name, coalesce(type, 'expense'), color, icon, parent_id, coalesce(is_default, false),
         coalesce(sort_order, 0), coalesce(created_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,categories}', '[]'::jsonb)) as x(
    id uuid, name text, type text, color text, icon text, parent_id uuid,
    is_default boolean, sort_order int, created_at timestamptz
  )
  where parent_id is null;

  insert into public.categories (
    id, user_id, name, type, color, icon, parent_id, is_default, sort_order, created_at
  )
  select id, v_uid, name, coalesce(type, 'expense'), color, icon, parent_id, coalesce(is_default, false),
         coalesce(sort_order, 0), coalesce(created_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,categories}', '[]'::jsonb)) as x(
    id uuid, name text, type text, color text, icon text, parent_id uuid,
    is_default boolean, sort_order int, created_at timestamptz
  )
  where parent_id is not null;

  insert into public.loans (
    id, user_id, counterpart, type, amount, remaining, description, due_date, is_settled, settled_at, created_at, updated_at
  )
  select id, v_uid, counterpart, type, amount, remaining, description, due_date, coalesce(is_settled, false),
         settled_at, coalesce(created_at, now()), coalesce(updated_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,loans}', '[]'::jsonb)) as x(
    id uuid, counterpart text, type text, amount numeric, remaining numeric,
    description text, due_date date, is_settled boolean, settled_at timestamptz,
    created_at timestamptz, updated_at timestamptz
  );

  insert into public.recurring_rules (
    id, user_id, account_id, category_id, type, amount, description, frequency, start_date, end_date,
    next_due_date, last_run_date, is_active, auto_create, created_at, updated_at
  )
  select id, v_uid, account_id, category_id, type, amount, description, frequency, start_date, end_date,
         next_due_date, last_run_date, coalesce(is_active, true), coalesce(auto_create, false),
         coalesce(created_at, now()), coalesce(updated_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,recurringRules}', '[]'::jsonb)) as x(
    id uuid, account_id uuid, category_id uuid, type text, amount numeric, description text,
    frequency text, start_date date, end_date date, next_due_date date, last_run_date date,
    is_active boolean, auto_create boolean, created_at timestamptz, updated_at timestamptz
  );

  insert into public.transactions (
    id, user_id, account_id, category_id, type, amount, description, notes, date,
    transfer_peer_id, recurring_id, receipt_url, receipt_data, created_at, updated_at
  )
  select id, v_uid, account_id, category_id, type, amount, description, notes, date,
         transfer_peer_id, recurring_id, receipt_url, receipt_data, coalesce(created_at, now()), coalesce(updated_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,transactions}', '[]'::jsonb)) as x(
    id uuid, account_id uuid, category_id uuid, type text, amount numeric,
    description text, notes text, date date, transfer_peer_id uuid, recurring_id uuid,
    receipt_url text, receipt_data jsonb, created_at timestamptz, updated_at timestamptz
  )
  where type <> 'transfer';

  insert into public.transactions (
    id, user_id, account_id, category_id, type, amount, description, notes, date,
    transfer_peer_id, recurring_id, receipt_url, receipt_data, created_at, updated_at
  )
  select id, v_uid, account_id, category_id, type, amount, description, notes, date,
         transfer_peer_id, recurring_id, receipt_url, receipt_data, coalesce(created_at, now()), coalesce(updated_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,transactions}', '[]'::jsonb)) as x(
    id uuid, account_id uuid, category_id uuid, type text, amount numeric,
    description text, notes text, date date, transfer_peer_id uuid, recurring_id uuid,
    receipt_url text, receipt_data jsonb, created_at timestamptz, updated_at timestamptz
  )
  where type = 'transfer';

  insert into public.loan_payments (
    id, loan_id, user_id, amount, paid_at, notes, created_at
  )
  select id, loan_id, v_uid, amount, coalesce(paid_at, now()), notes, coalesce(created_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,loanPayments}', '[]'::jsonb)) as x(
    id uuid, loan_id uuid, amount numeric, paid_at timestamptz, notes text, created_at timestamptz
  );

  insert into public.budgets (
    id, user_id, category_id, amount, month, year, created_at, updated_at
  )
  select id, v_uid, category_id, amount, month, year, coalesce(created_at, now()), coalesce(updated_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,budgets}', '[]'::jsonb)) as x(
    id uuid, category_id uuid, amount numeric, month int, year int, created_at timestamptz, updated_at timestamptz
  );

  insert into public.birthdays (
    id, user_id, name, birth_date, reminder_days, notes, created_at, updated_at
  )
  select id, v_uid, name, birth_date, coalesce(reminder_days, '{7}'::int[]), notes,
         coalesce(created_at, now()), coalesce(updated_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,birthdays}', '[]'::jsonb)) as x(
    id uuid, name text, birth_date date, reminder_days int[], notes text, created_at timestamptz, updated_at timestamptz
  );

  insert into public.birthday_reminder_log (
    id, birthday_id, user_id, days_before, year, sent_at
  )
  select id, birthday_id, v_uid, days_before, year, coalesce(sent_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,birthdayReminderLog}', '[]'::jsonb)) as x(
    id uuid, birthday_id uuid, days_before int, year int, sent_at timestamptz
  );

  insert into public.audit_logs (
    id, user_id, action, table_name, record_id, old_data, new_data, ip_address, created_at
  )
  select id, v_uid, 'RESTORED_' || action, table_name, record_id, old_data, new_data, null, coalesce(created_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,auditLogs}', '[]'::jsonb)) as x(
    id uuid, action text, table_name text, record_id uuid, old_data jsonb, new_data jsonb, created_at timestamptz
  );

  if (select count(*) from public.accounts where user_id = v_uid) <> v_accounts then
    raise exception 'ACCOUNTING_MISMATCH';
  end if;
  if (select count(*) from public.categories where user_id = v_uid) <> v_categories then
    raise exception 'ACCOUNTING_MISMATCH';
  end if;
  if (select count(*) from public.transactions where user_id = v_uid) <> v_transactions then
    raise exception 'ACCOUNTING_MISMATCH';
  end if;
  if (select count(*) from public.budgets where user_id = v_uid) <> v_budgets then
    raise exception 'ACCOUNTING_MISMATCH';
  end if;
  if (select count(*) from public.recurring_rules where user_id = v_uid) <> v_recurring then
    raise exception 'ACCOUNTING_MISMATCH';
  end if;
  if (select count(*) from public.loans where user_id = v_uid) <> v_loans then
    raise exception 'ACCOUNTING_MISMATCH';
  end if;
  if (select count(*) from public.loan_payments where user_id = v_uid) <> v_loan_payments then
    raise exception 'ACCOUNTING_MISMATCH';
  end if;
  if (select count(*) from public.birthdays where user_id = v_uid) <> v_birthdays then
    raise exception 'ACCOUNTING_MISMATCH';
  end if;
  if (select count(*) from public.birthday_reminder_log where user_id = v_uid) <> v_birthday_logs then
    raise exception 'ACCOUNTING_MISMATCH';
  end if;

  v_counts := jsonb_build_object(
    'accounts', v_accounts,
    'categories', v_categories,
    'transactions', v_transactions,
    'budgets', v_budgets,
    'recurringRules', v_recurring,
    'loans', v_loans,
    'loanPayments', v_loan_payments,
    'birthdays', v_birthdays,
    'birthdayReminderLog', v_birthday_logs,
    'auditLogs', v_audit_logs
  );

  update public.backup_restore_runs
     set status = 'completed',
         completed_at = now(),
         counts = v_counts
   where id = v_run_id;

  return jsonb_build_object(
    'restoreId', v_run_id,
    'status', 'completed',
    'counts', v_counts,
    'startedAt', v_now,
    'completedAt', now(),
    'verified', true
  );
exception
  when others then
    raise;
end;
$$;

revoke all on function public.restore_aurora_backup_v1_empty_account(uuid, text, jsonb) from public;
grant execute on function public.restore_aurora_backup_v1_empty_account(uuid, text, jsonb) to authenticated;
