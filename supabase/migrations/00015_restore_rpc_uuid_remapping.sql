-- Migration 00015: rimappatura UUID durante il restore.
--
-- Problema: le migration 00013-00014 conservavano gli UUID del backup come PK,
-- causando UUID_CONFLICT quando gli stessi UUID esistevano gia' nel DB
-- (account sorgente e destinazione nello stesso progetto Supabase).
--
-- Soluzione: ogni record del backup riceve un nuovo UUID nel DB destinazione.
-- Le FK vengono rimappate coerentemente tramite tabelle temporanee.
-- Le categorie default vengono riconciliate (riutilizzate se esiste un match
-- nome+tipo nell'account destinazione) senza inserire duplicati.
-- Nessun dato dell'account sorgente viene modificato o eliminato.

create or replace function public.restore_aurora_backup_v1_empty_account(
  p_token_id uuid,
  p_token    text,
  p_backup   jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid             uuid        := auth.uid();
  v_token           public.backup_restore_tokens%rowtype;
  v_run_id          uuid        := gen_random_uuid();
  v_counts          jsonb       := '{}'::jsonb;
  v_checksum        text        := p_backup #>> '{integrity,checksum}';
  v_schema_version  int         := coalesce((p_backup ->> 'schemaVersion')::int, 0);
  v_now             timestamptz := now();
  v_accounts        int := jsonb_array_length(coalesce(p_backup #> '{data,accounts}',            '[]'::jsonb));
  v_categories      int := jsonb_array_length(coalesce(p_backup #> '{data,categories}',          '[]'::jsonb));
  v_transactions    int := jsonb_array_length(coalesce(p_backup #> '{data,transactions}',        '[]'::jsonb));
  v_budgets         int := jsonb_array_length(coalesce(p_backup #> '{data,budgets}',             '[]'::jsonb));
  v_recurring       int := jsonb_array_length(coalesce(p_backup #> '{data,recurringRules}',      '[]'::jsonb));
  v_loans           int := jsonb_array_length(coalesce(p_backup #> '{data,loans}',               '[]'::jsonb));
  v_loan_payments   int := jsonb_array_length(coalesce(p_backup #> '{data,loanPayments}',        '[]'::jsonb));
  v_birthdays       int := jsonb_array_length(coalesce(p_backup #> '{data,birthdays}',           '[]'::jsonb));
  v_birthday_logs   int := jsonb_array_length(coalesce(p_backup #> '{data,birthdayReminderLog}', '[]'::jsonb));
  v_audit_logs      int := jsonb_array_length(coalesce(p_backup #> '{data,auditLogs}',           '[]'::jsonb));
  v_reconciled      int := 0;
begin

  -- autenticazione
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  -- formato backup
  if p_backup ->> 'format' <> 'aurora-backup' or v_schema_version <> 1 then
    raise exception 'INVALID_BACKUP';
  end if;

  -- lock per evitare restore concorrenti sullo stesso account
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 20260717));

  -- validazione token (digest e' nello schema extensions)
  select *
    into v_token
    from public.backup_restore_tokens
   where id              = p_token_id
     and user_id         = v_uid
     and token_hash      = encode(digest(p_token, 'sha256'), 'hex')
     and backup_checksum = v_checksum
     and schema_version  = 1
     and mode            = 'empty_account_restore'
     and readiness       = 'ready'
     and used_at         is null
     and expires_at      > v_now
   for update;

  if not found then
    raise exception 'TOKEN_INVALID';
  end if;

  -- consuma il token nella stessa transazione
  update public.backup_restore_tokens
     set used_at = v_now
   where id      = v_token.id
     and used_at is null;

  if not found then
    raise exception 'TOKEN_ALREADY_USED';
  end if;

  -- l'account destinazione deve essere privo di dati utente
  -- (le categorie default sono ammesse: vengono riconciliate, non eliminate)
  if exists (select 1 from public.accounts        where user_id = v_uid)
  or exists (select 1 from public.transactions    where user_id = v_uid)
  or exists (select 1 from public.budgets         where user_id = v_uid)
  or exists (select 1 from public.recurring_rules where user_id = v_uid)
  or exists (select 1 from public.loans           where user_id = v_uid)
  or exists (select 1 from public.loan_payments   where user_id = v_uid)
  or exists (select 1 from public.birthdays       where user_id = v_uid)
  or exists (select 1 from public.categories      where user_id = v_uid and is_default is not true)
  then
    raise exception 'ACCOUNT_NOT_EMPTY';
  end if;

  -- ── MAPPE UUID ────────────────────────────────────────────────────────────
  -- Ogni UUID del backup viene rimappato a un nuovo UUID nel DB destinazione.
  -- Le FK vengono aggiornate coerentemente. I dati dell'account sorgente
  -- non vengono mai toccati.

  create temp table _account_map  (src_id uuid primary key, dst_id uuid not null) on commit drop;
  create temp table _category_map (src_id uuid primary key, dst_id uuid not null,
                                   is_existing boolean not null default false)     on commit drop;
  create temp table _txn_map      (src_id uuid primary key, dst_id uuid not null) on commit drop;
  create temp table _loan_map     (src_id uuid primary key, dst_id uuid not null) on commit drop;
  create temp table _budget_map   (src_id uuid primary key, dst_id uuid not null) on commit drop;
  create temp table _recur_map    (src_id uuid primary key, dst_id uuid not null) on commit drop;
  create temp table _bday_map     (src_id uuid primary key, dst_id uuid not null) on commit drop;

  -- conti: tutti nuovi UUID
  insert into _account_map (src_id, dst_id)
  select x.id, gen_random_uuid()
    from jsonb_to_recordset(coalesce(p_backup #> '{data,accounts}', '[]'::jsonb)) as x(id uuid);

  -- categorie: tutti nuovi UUID (riconciliazione applicata subito dopo)
  insert into _category_map (src_id, dst_id, is_existing)
  select x.id, gen_random_uuid(), false
    from jsonb_to_recordset(coalesce(p_backup #> '{data,categories}', '[]'::jsonb)) as x(id uuid);

  -- riconcilia categorie parent default:
  -- se nel DB destinazione esiste gia' una categoria default con stesso nome+tipo,
  -- riutilizza il suo UUID senza inserire un duplicato.
  update _category_map cm
     set dst_id = matched.dst_id, is_existing = true
    from (
      select bcat.id as src_id, dst_cat.id as dst_id
        from jsonb_to_recordset(coalesce(p_backup #> '{data,categories}', '[]'::jsonb)) as bcat(
               id uuid, name text, type text, is_default boolean, parent_id uuid)
        join public.categories dst_cat
          on dst_cat.user_id    = v_uid
         and dst_cat.is_default = true
         and dst_cat.parent_id  is null
         and dst_cat.name       = bcat.name
         and dst_cat.type       = bcat.type
       where bcat.is_default is true
         and bcat.parent_id  is null
    ) matched
   where cm.src_id = matched.src_id;

  -- riconcilia sottocategorie default:
  -- il parent deve essere gia' riconciliato (is_existing = true).
  update _category_map cm
     set dst_id = matched.dst_id, is_existing = true
    from (
      select bchild.id as src_id, dst_child.id as dst_id
        from jsonb_to_recordset(coalesce(p_backup #> '{data,categories}', '[]'::jsonb)) as bchild(
               id uuid, name text, type text, is_default boolean, parent_id uuid)
        join _category_map parent_map
          on parent_map.src_id      = bchild.parent_id
         and parent_map.is_existing = true
        join public.categories dst_child
          on dst_child.user_id    = v_uid
         and dst_child.is_default = true
         and dst_child.parent_id  = parent_map.dst_id
         and dst_child.name       = bchild.name
         and dst_child.type       = bchild.type
       where bchild.is_default is true
         and bchild.parent_id  is not null
    ) matched
   where cm.src_id = matched.src_id;

  select count(*) into v_reconciled
    from _category_map where is_existing = true;

  -- transazioni, prestiti, budget, ricorrenze, compleanni: tutti nuovi UUID
  insert into _txn_map   (src_id, dst_id)
  select x.id, gen_random_uuid()
    from jsonb_to_recordset(coalesce(p_backup #> '{data,transactions}',  '[]'::jsonb)) as x(id uuid);

  insert into _loan_map  (src_id, dst_id)
  select x.id, gen_random_uuid()
    from jsonb_to_recordset(coalesce(p_backup #> '{data,loans}',          '[]'::jsonb)) as x(id uuid);

  insert into _budget_map(src_id, dst_id)
  select x.id, gen_random_uuid()
    from jsonb_to_recordset(coalesce(p_backup #> '{data,budgets}',        '[]'::jsonb)) as x(id uuid);

  insert into _recur_map (src_id, dst_id)
  select x.id, gen_random_uuid()
    from jsonb_to_recordset(coalesce(p_backup #> '{data,recurringRules}', '[]'::jsonb)) as x(id uuid);

  insert into _bday_map  (src_id, dst_id)
  select x.id, gen_random_uuid()
    from jsonb_to_recordset(coalesce(p_backup #> '{data,birthdays}',      '[]'::jsonb)) as x(id uuid);

  -- ── RECORD DEL RESTORE ───────────────────────────────────────────────────

  insert into public.backup_restore_runs (
    id, user_id, token_id, backup_checksum, schema_version, mode, status, app_version
  ) values (
    v_run_id, v_uid, v_token.id, v_checksum, 1,
    'empty_account_restore', 'running', p_backup ->> 'appVersion'
  );

  -- ── PROFILO ───────────────────────────────────────────────────────────────

  insert into public.profiles (
    id, display_name, avatar_url, currency, locale, timezone, onboarding_done, created_at, updated_at
  ) values (
    v_uid,
    nullif(p_backup #>> '{data,profile,display_name}', ''),
    nullif(p_backup #>> '{data,profile,avatar_url}',   ''),
    coalesce(p_backup #>> '{data,profile,currency}',   'EUR'),
    coalesce(p_backup #>> '{data,profile,locale}',     'it-IT'),
    coalesce(p_backup #>> '{data,profile,timezone}',   'Europe/Rome'),
    coalesce((p_backup #>> '{data,profile,onboarding_done}')::boolean, false),
    coalesce((p_backup #>> '{data,profile,created_at}')::timestamptz,  now()),
    coalesce((p_backup #>> '{data,profile,updated_at}')::timestamptz,  now())
  )
  on conflict (id) do update
    set display_name    = excluded.display_name,
        avatar_url      = excluded.avatar_url,
        currency        = excluded.currency,
        locale          = excluded.locale,
        timezone        = excluded.timezone,
        onboarding_done = excluded.onboarding_done,
        updated_at      = excluded.updated_at;

  -- ── CONTI (UUID rimappati) ────────────────────────────────────────────────

  insert into public.accounts (
    id, user_id, name, type, color, icon, balance, currency,
    is_active, is_hidden, sort_order, created_at, updated_at
  )
  select
    am.dst_id, v_uid,
    x.name, coalesce(x.type, 'checking'), x.color, x.icon,
    coalesce(x.balance, 0), coalesce(x.currency, 'EUR'),
    coalesce(x.is_active, true), coalesce(x.is_hidden, false),
    coalesce(x.sort_order, 0),
    coalesce(x.created_at, now()), coalesce(x.updated_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,accounts}', '[]'::jsonb)) as x(
    id uuid, name text, type text, color text, icon text,
    balance numeric, currency text, is_active boolean, is_hidden boolean,
    sort_order int, created_at timestamptz, updated_at timestamptz
  )
  join _account_map am on am.src_id = x.id;

  -- ── CATEGORIE PARENT (UUID rimappati, salto le riconciliate gia' esistenti) ─

  insert into public.categories (
    id, user_id, name, type, color, icon, parent_id, is_default, sort_order, created_at
  )
  select
    cm.dst_id, v_uid,
    x.name, coalesce(x.type, 'expense'), x.color, x.icon,
    null,
    coalesce(x.is_default, false),
    coalesce(x.sort_order, 0), coalesce(x.created_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,categories}', '[]'::jsonb)) as x(
    id uuid, name text, type text, color text, icon text,
    parent_id uuid, is_default boolean, sort_order int, created_at timestamptz
  )
  join _category_map cm on cm.src_id = x.id
  where x.parent_id    is null
    and cm.is_existing = false;

  -- ── CATEGORIE FIGLIE (parent_id rimappato, salto le riconciliate) ─────────

  insert into public.categories (
    id, user_id, name, type, color, icon, parent_id, is_default, sort_order, created_at
  )
  select
    cm.dst_id, v_uid,
    x.name, coalesce(x.type, 'expense'), x.color, x.icon,
    parent_cm.dst_id,
    coalesce(x.is_default, false),
    coalesce(x.sort_order, 0), coalesce(x.created_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,categories}', '[]'::jsonb)) as x(
    id uuid, name text, type text, color text, icon text,
    parent_id uuid, is_default boolean, sort_order int, created_at timestamptz
  )
  join _category_map cm        on cm.src_id        = x.id
  join _category_map parent_cm on parent_cm.src_id = x.parent_id
  where x.parent_id    is not null
    and cm.is_existing = false;

  -- ── PRESTITI (UUID rimappati) ─────────────────────────────────────────────

  insert into public.loans (
    id, user_id, counterpart, type, amount, remaining, description,
    due_date, is_settled, settled_at, created_at, updated_at
  )
  select
    lm.dst_id, v_uid,
    x.counterpart, x.type, x.amount, x.remaining, x.description,
    x.due_date, coalesce(x.is_settled, false), x.settled_at,
    coalesce(x.created_at, now()), coalesce(x.updated_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,loans}', '[]'::jsonb)) as x(
    id uuid, counterpart text, type text, amount numeric, remaining numeric,
    description text, due_date date, is_settled boolean, settled_at timestamptz,
    created_at timestamptz, updated_at timestamptz
  )
  join _loan_map lm on lm.src_id = x.id;

  -- ── REGOLE RICORRENTI (account_id e category_id rimappati) ───────────────

  insert into public.recurring_rules (
    id, user_id, account_id, category_id, type, amount, description,
    frequency, start_date, end_date, next_due_date, last_run_date,
    is_active, auto_create, created_at, updated_at
  )
  select
    rm.dst_id, v_uid,
    am.dst_id,
    cm.dst_id,
    x.type, x.amount, x.description, x.frequency,
    x.start_date, x.end_date, x.next_due_date, x.last_run_date,
    coalesce(x.is_active, true), coalesce(x.auto_create, false),
    coalesce(x.created_at, now()), coalesce(x.updated_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,recurringRules}', '[]'::jsonb)) as x(
    id uuid, account_id uuid, category_id uuid, type text, amount numeric,
    description text, frequency text, start_date date, end_date date,
    next_due_date date, last_run_date date,
    is_active boolean, auto_create boolean,
    created_at timestamptz, updated_at timestamptz
  )
  join  _recur_map   rm on rm.src_id = x.id
  join  _account_map am on am.src_id = x.account_id
  left join _category_map cm on cm.src_id = x.category_id;

  -- ── TRANSAZIONI NON-TRANSFER (transfer_peer_id = null) ───────────────────

  insert into public.transactions (
    id, user_id, account_id, category_id, type, amount, description, notes, date,
    transfer_peer_id, recurring_id, receipt_url, receipt_data, created_at, updated_at
  )
  select
    tm.dst_id, v_uid,
    am.dst_id,
    cm.dst_id,
    x.type, x.amount, x.description, x.notes, x.date,
    null,        -- transfer_peer_id: non applicabile per non-transfer
    rm.dst_id,   -- recurring_id rimappato se presente
    x.receipt_url, x.receipt_data,
    coalesce(x.created_at, now()), coalesce(x.updated_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,transactions}', '[]'::jsonb)) as x(
    id uuid, account_id uuid, category_id uuid, type text, amount numeric,
    description text, notes text, date date,
    transfer_peer_id uuid, recurring_id uuid,
    receipt_url text, receipt_data jsonb,
    created_at timestamptz, updated_at timestamptz
  )
  join  _txn_map     tm on tm.src_id = x.id
  join  _account_map am on am.src_id = x.account_id
  left join _category_map cm on cm.src_id = x.category_id
  left join _recur_map    rm on rm.src_id = x.recurring_id
  where x.type <> 'transfer';

  -- ── TRANSAZIONI TRANSFER (transfer_peer_id rimappato) ────────────────────
  -- transfer_peer_id puo' puntare a una transazione (formato moderno)
  -- oppure a un conto (formato legacy a due righe).
  -- In entrambi i casi, viene rimappato tramite la mappa corretta.

  insert into public.transactions (
    id, user_id, account_id, category_id, type, amount, description, notes, date,
    transfer_peer_id, recurring_id, receipt_url, receipt_data, created_at, updated_at
  )
  select
    tm.dst_id, v_uid,
    am.dst_id,
    cm.dst_id,
    x.type, x.amount, x.description, x.notes, x.date,
    coalesce(
      (select dst_id from _txn_map     where src_id = x.transfer_peer_id),
      (select dst_id from _account_map where src_id = x.transfer_peer_id)
    ),
    rm.dst_id,
    x.receipt_url, x.receipt_data,
    coalesce(x.created_at, now()), coalesce(x.updated_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,transactions}', '[]'::jsonb)) as x(
    id uuid, account_id uuid, category_id uuid, type text, amount numeric,
    description text, notes text, date date,
    transfer_peer_id uuid, recurring_id uuid,
    receipt_url text, receipt_data jsonb,
    created_at timestamptz, updated_at timestamptz
  )
  join  _txn_map     tm on tm.src_id = x.id
  join  _account_map am on am.src_id = x.account_id
  left join _category_map cm on cm.src_id = x.category_id
  left join _recur_map    rm on rm.src_id = x.recurring_id
  where x.type = 'transfer';

  -- ── PAGAMENTI PRESTITI (loan_id rimappato) ────────────────────────────────

  insert into public.loan_payments (
    id, loan_id, user_id, amount, paid_at, notes, created_at
  )
  select
    gen_random_uuid(), lm.dst_id, v_uid,
    x.amount, coalesce(x.paid_at, now()), x.notes, coalesce(x.created_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,loanPayments}', '[]'::jsonb)) as x(
    id uuid, loan_id uuid, amount numeric, paid_at timestamptz,
    notes text, created_at timestamptz
  )
  join _loan_map lm on lm.src_id = x.loan_id;

  -- ── BUDGET (category_id rimappato) ───────────────────────────────────────

  insert into public.budgets (
    id, user_id, category_id, amount, month, year, created_at, updated_at
  )
  select
    bm.dst_id, v_uid,
    cm.dst_id,
    x.amount, x.month, x.year,
    coalesce(x.created_at, now()), coalesce(x.updated_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,budgets}', '[]'::jsonb)) as x(
    id uuid, category_id uuid, amount numeric, month int, year int,
    created_at timestamptz, updated_at timestamptz
  )
  join  _budget_map   bm on bm.src_id = x.id
  join  _category_map cm on cm.src_id = x.category_id;

  -- ── COMPLEANNI (UUID rimappati) ───────────────────────────────────────────

  insert into public.birthdays (
    id, user_id, name, birth_date, reminder_days, notes, created_at, updated_at
  )
  select
    bdm.dst_id, v_uid,
    x.name, x.birth_date, coalesce(x.reminder_days, '{7}'::int[]), x.notes,
    coalesce(x.created_at, now()), coalesce(x.updated_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,birthdays}', '[]'::jsonb)) as x(
    id uuid, name text, birth_date date, reminder_days int[],
    notes text, created_at timestamptz, updated_at timestamptz
  )
  join _bday_map bdm on bdm.src_id = x.id;

  -- ── LOG REMINDER COMPLEANNI (birthday_id rimappato) ──────────────────────

  insert into public.birthday_reminder_log (
    id, birthday_id, user_id, days_before, year, sent_at
  )
  select
    gen_random_uuid(), bdm.dst_id, v_uid,
    x.days_before, x.year, coalesce(x.sent_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,birthdayReminderLog}', '[]'::jsonb)) as x(
    id uuid, birthday_id uuid, days_before int, year int, sent_at timestamptz
  )
  join _bday_map bdm on bdm.src_id = x.birthday_id;

  -- ── AUDIT LOG (record_id e' informativo, non rimappato) ──────────────────

  insert into public.audit_logs (
    id, user_id, action, table_name, record_id, old_data, new_data, ip_address, created_at
  )
  select
    gen_random_uuid(), v_uid,
    'RESTORED_' || x.action, x.table_name, x.record_id,
    x.old_data, x.new_data, null,
    coalesce(x.created_at, now())
  from jsonb_to_recordset(coalesce(p_backup #> '{data,auditLogs}', '[]'::jsonb)) as x(
    id uuid, action text, table_name text, record_id uuid,
    old_data jsonb, new_data jsonb, created_at timestamptz
  );

  -- ── VERIFICA CONTABILE ────────────────────────────────────────────────────

  -- conti: conteggio esatto
  if (select count(*) from public.accounts where user_id = v_uid) <> v_accounts then
    raise exception 'ACCOUNTING_MISMATCH';
  end if;

  -- categorie: ogni categoria del backup deve avere un dst_id valido nel DB
  -- (riconciliate = gia' presenti, non-riconciliate = appena inserite)
  if (select count(*) from _category_map) <> v_categories then
    raise exception 'ACCOUNTING_MISMATCH';
  end if;
  if exists (
    select 1 from _category_map cm
     where not exists (
       select 1 from public.categories c
        where c.id = cm.dst_id and c.user_id = v_uid
     )
  ) then
    raise exception 'ACCOUNTING_MISMATCH';
  end if;

  if (select count(*) from public.transactions    where user_id = v_uid) <> v_transactions  then raise exception 'ACCOUNTING_MISMATCH'; end if;
  if (select count(*) from public.budgets         where user_id = v_uid) <> v_budgets       then raise exception 'ACCOUNTING_MISMATCH'; end if;
  if (select count(*) from public.recurring_rules where user_id = v_uid) <> v_recurring     then raise exception 'ACCOUNTING_MISMATCH'; end if;
  if (select count(*) from public.loans           where user_id = v_uid) <> v_loans         then raise exception 'ACCOUNTING_MISMATCH'; end if;
  if (select count(*) from public.loan_payments   where user_id = v_uid) <> v_loan_payments then raise exception 'ACCOUNTING_MISMATCH'; end if;
  if (select count(*) from public.birthdays       where user_id = v_uid) <> v_birthdays     then raise exception 'ACCOUNTING_MISMATCH'; end if;
  if (select count(*) from public.birthday_reminder_log where user_id = v_uid) <> v_birthday_logs then raise exception 'ACCOUNTING_MISMATCH'; end if;

  v_counts := jsonb_build_object(
    'accounts',              v_accounts,
    'categories',            v_categories,
    'transactions',          v_transactions,
    'budgets',               v_budgets,
    'recurringRules',        v_recurring,
    'loans',                 v_loans,
    'loanPayments',          v_loan_payments,
    'birthdays',             v_birthdays,
    'birthdayReminderLog',   v_birthday_logs,
    'auditLogs',             v_audit_logs,
    'reconciledCategories',  v_reconciled
  );

  update public.backup_restore_runs
     set status       = 'completed',
         completed_at = now(),
         counts       = v_counts
   where id = v_run_id;

  return jsonb_build_object(
    'restoreId',            v_run_id,
    'status',               'completed',
    'counts',               v_counts,
    'reconciledCategories', v_reconciled,
    'startedAt',            v_now,
    'completedAt',          now(),
    'verified',             true
  );

exception
  when others then
    raise;
end;
$$;

revoke all on function public.restore_aurora_backup_v1_empty_account(uuid, text, jsonb) from public;
grant execute on function public.restore_aurora_backup_v1_empty_account(uuid, text, jsonb) to authenticated;
