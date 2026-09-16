-- Sprint 26 - Riconciliazione bancaria, saldo verificato e movimenti neutri (partite di giro)
-- Non distruttiva: solo ADD COLUMN / CREATE TABLE / CREATE OR REPLACE. RLS-first.
--
-- Contesto:
--   - accounts.balance resta l'unica fonte di verita del saldo, mutato solo dalle
--     RPC atomiche create/update/delete_transaction_atomic (00002/00003). Questa
--     migration NON introduce un secondo motore di saldo: la riconciliazione è
--     un livello di controllo/confronto sopra il saldo persistito, mai una
--     riscrittura automatica dello stesso.
--   - "Movimento neutro" (partita di giro / rimborso di terzi) è modellato come
--     un flag booleano sulla transazione esistente, non come un nuovo
--     transaction.type: questo evita di toccare la logica di saldo nelle RPC
--     (che resta invariata per income/expense/transfer) e i tanti punti del
--     codice che fanno switch su transaction.type.

-- ============================================================
-- 1. transactions.is_neutral — flag "partita di giro / rimborso di terzi"
-- ============================================================
alter table public.transactions add column if not exists is_neutral boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_neutral_not_transfer'
      and conrelid = 'public.transactions'::regclass
  ) then
    -- Un giroconto non porta mai categoria (vedi category-compatibility.ts) e per
    -- lo stesso motivo non porta mai il flag neutro: è già escluso dalle metriche
    -- economiche tramite transferReferenceKind, marcarlo neutro sarebbe ridondante
    -- e comprometterebbe la distinzione richiesta tra "neutro" e "transfer".
    alter table public.transactions
      add constraint transactions_neutral_not_transfer check (type <> 'transfer' or is_neutral = false);
  end if;
end $$;

create index if not exists idx_transactions_user_neutral on public.transactions(user_id) where is_neutral = true;

comment on column public.transactions.is_neutral is 'Movimento neutro / partita di giro: modifica il saldo del conto normalmente ma è escluso da spese, entrate, budget, risparmio e statistiche economiche.';

-- ============================================================
-- 2. account_reconciliations — storico riconciliazioni estratto conto
-- ============================================================
create table if not exists public.account_reconciliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  statement_date date not null,
  bank_balance numeric(15, 2) not null,
  app_balance_snapshot numeric(15, 2) not null,
  difference numeric(15, 2) generated always as (round(bank_balance - app_balance_snapshot, 2)) stored,
  status text not null default 'pending',
  source_type text not null default 'manual',
  source_reference text,
  reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_reconciliations_status_check check (status in ('reconciled', 'mismatch', 'pending', 'superseded')),
  constraint account_reconciliations_source_type_check check (source_type in ('manual', 'import'))
);

comment on table public.account_reconciliations is 'Storico delle riconciliazioni tra saldo estratto conto banca e saldo Aurora per un conto. Livello di controllo sopra accounts.balance, mai una seconda fonte di verita: non corregge automaticamente il saldo.';
comment on column public.account_reconciliations.app_balance_snapshot is 'Saldo accounts.balance del conto al momento della riconciliazione (fotografia, non ricalcolato a posteriori).';
comment on column public.account_reconciliations.difference is 'bank_balance - app_balance_snapshot, arrotondata al centesimo. |differenza| <= 0.01 => riconciliato.';

create index if not exists idx_account_reconciliations_user on public.account_reconciliations(user_id);
create index if not exists idx_account_reconciliations_account_created on public.account_reconciliations(account_id, created_at desc);

alter table public.account_reconciliations enable row level security;

drop policy if exists "Users can view own account reconciliations" on public.account_reconciliations;
create policy "Users can view own account reconciliations"
on public.account_reconciliations for select
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own account reconciliations" on public.account_reconciliations;
create policy "Users can insert own account reconciliations"
on public.account_reconciliations for insert
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.accounts a
    where a.id = account_id and a.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update own account reconciliations" on public.account_reconciliations;
create policy "Users can update own account reconciliations"
on public.account_reconciliations for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own account reconciliations" on public.account_reconciliations;
create policy "Users can delete own account reconciliations"
on public.account_reconciliations for delete
using ((select auth.uid()) = user_id);

drop trigger if exists set_updated_at on public.account_reconciliations;
create trigger set_updated_at before update on public.account_reconciliations
for each row execute function public.set_updated_at();

-- Ogni nuova riconciliazione per un conto "supersede" le precedenti riconciliazioni
-- attive (reconciled/mismatch) dello stesso conto: lo storico resta (nessuna riga
-- viene eliminata), ma "ultima riconciliazione valida" e sempre derivabile senza
-- stato duplicato su accounts, prendendo l'ultima riga per created_at.
create or replace function public.supersede_previous_reconciliations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.account_reconciliations
     set status = 'superseded'
   where account_id = new.account_id
     and id <> new.id
     and user_id = new.user_id
     and status in ('reconciled', 'mismatch');
  return new;
end;
$$;

drop trigger if exists supersede_previous_reconciliations on public.account_reconciliations;
create trigger supersede_previous_reconciliations
after insert on public.account_reconciliations
for each row execute function public.supersede_previous_reconciliations();

revoke execute on function public.supersede_previous_reconciliations() from public, anon, authenticated;

-- ============================================================
-- 3. create_transaction_atomic — aggiunge p_is_neutral (default false)
-- ============================================================
-- Postgres identifica le funzioni per nome + lista tipi parametro: aggiungere un
-- parametro extra a una funzione esistente crea un OVERLOAD ambiguo se fatto con
-- CREATE OR REPLACE, non una sostituzione. Va quindi droppata la firma precedente
-- (stesso pattern usato in 00003 per adjust_account_balance).
drop function if exists public.create_transaction_atomic(uuid, text, numeric, date, text, uuid, text, uuid, uuid);

create or replace function public.create_transaction_atomic(
  p_account_id          uuid,
  p_type                text,
  p_amount              numeric,
  p_date                date,
  p_description         text       default null,
  p_category_id         uuid       default null,
  p_notes               text       default null,
  p_destination_account_id uuid    default null,
  p_recurring_id        uuid       default null,
  p_is_neutral          boolean    default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_tx          public.transactions%rowtype;
  v_src_owner   uuid;
  v_dst_owner   uuid;
begin
  if p_type not in ('income', 'expense', 'transfer') then
    raise exception 'Invalid transaction type: %', p_type;
  end if;

  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  select user_id into v_src_owner
    from public.accounts
   where id = p_account_id;

  if v_src_owner is null then
    raise exception 'Source account not found';
  end if;
  if v_src_owner <> v_uid then
    raise exception 'Source account not owned by current user';
  end if;

  if p_type = 'transfer' then
    if p_destination_account_id is null then
      raise exception 'Destination account is required for transfers';
    end if;
    if p_account_id = p_destination_account_id then
      raise exception 'Source and destination accounts must differ';
    end if;

    select user_id into v_dst_owner
      from public.accounts
     where id = p_destination_account_id;

    if v_dst_owner is null then
      raise exception 'Destination account not found';
    end if;
    if v_dst_owner <> v_uid then
      raise exception 'Destination account not owned by current user';
    end if;
  end if;

  if p_category_id is not null then
    if not exists (
      select 1 from public.categories
       where id = p_category_id and user_id = v_uid
    ) then
      raise exception 'Category not found or not owned by current user';
    end if;
  end if;

  insert into public.transactions (
    user_id, account_id, type, amount, date,
    description, category_id, notes,
    transfer_peer_id, recurring_id, is_neutral
  ) values (
    v_uid, p_account_id, p_type, p_amount, p_date,
    p_description,
    case when p_type = 'transfer' then null else p_category_id end,
    p_notes,
    case when p_type = 'transfer' then p_destination_account_id else null end,
    p_recurring_id,
    case when p_type = 'transfer' then false else coalesce(p_is_neutral, false) end
  )
  returning * into v_tx;

  if p_type = 'income' then
    update public.accounts
       set balance = balance + p_amount, updated_at = now()
     where id = p_account_id and user_id = v_uid;

  elsif p_type = 'expense' then
    update public.accounts
       set balance = balance - p_amount, updated_at = now()
     where id = p_account_id and user_id = v_uid;

  elsif p_type = 'transfer' then
    update public.accounts
       set balance = balance - p_amount, updated_at = now()
     where id = p_account_id and user_id = v_uid;

    update public.accounts
       set balance = balance + p_amount, updated_at = now()
     where id = p_destination_account_id and user_id = v_uid;
  end if;

  insert into public.audit_logs (user_id, action, table_name, record_id, new_data)
  values (v_uid, 'CREATE', 'transactions', v_tx.id, to_jsonb(v_tx));

  return to_jsonb(v_tx);
end;
$$;

-- ============================================================
-- 4. update_transaction_atomic — aggiunge p_is_neutral (default null = invariato)
-- ============================================================
drop function if exists public.update_transaction_atomic(uuid, uuid, text, numeric, date, text, uuid, text, uuid, boolean);

create or replace function public.update_transaction_atomic(
  p_transaction_id        uuid,
  p_account_id            uuid       default null,
  p_type                  text       default null,
  p_amount                numeric    default null,
  p_date                  date       default null,
  p_description           text       default null,
  p_category_id           uuid       default null,
  p_notes                 text       default null,
  p_destination_account_id uuid      default null,
  p_clear_category        boolean    default false,
  p_is_neutral            boolean    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_old       public.transactions%rowtype;
  v_new       public.transactions%rowtype;
  v_new_acct  uuid;
  v_new_type  text;
  v_new_amt   numeric;
  v_new_dst   uuid;
  v_new_neutral boolean;
  v_owner     uuid;
begin
  select * into v_old
    from public.transactions
   where id = p_transaction_id;

  if v_old.id is null then
    raise exception 'Transaction not found';
  end if;
  if v_old.user_id <> v_uid then
    raise exception 'Transaction not owned by current user';
  end if;

  v_new_acct := coalesce(p_account_id,  v_old.account_id);
  v_new_type := coalesce(p_type,        v_old.type);
  v_new_amt  := coalesce(p_amount,      v_old.amount);
  v_new_dst  := case
                  when v_new_type = 'transfer'
                    then coalesce(p_destination_account_id, v_old.transfer_peer_id)
                  else null
                end;
  v_new_neutral := case
                     when v_new_type = 'transfer' then false
                     else coalesce(p_is_neutral, v_old.is_neutral)
                   end;

  if v_new_type not in ('income', 'expense', 'transfer') then
    raise exception 'Invalid transaction type: %', v_new_type;
  end if;
  if v_new_amt <= 0 then
    raise exception 'Amount must be positive';
  end if;

  if v_new_acct is distinct from v_old.account_id then
    select user_id into v_owner from public.accounts where id = v_new_acct;
    if v_owner is null or v_owner <> v_uid then
      raise exception 'New source account not found or not owned by current user';
    end if;
  end if;

  if v_new_type = 'transfer' then
    if v_new_dst is null then
      raise exception 'Destination account is required for transfers';
    end if;
    if v_new_acct = v_new_dst then
      raise exception 'Source and destination accounts must differ';
    end if;
    if v_new_dst is distinct from v_old.transfer_peer_id then
      select user_id into v_owner from public.accounts where id = v_new_dst;
      if v_owner is null or v_owner <> v_uid then
        raise exception 'New destination account not found or not owned by current user';
      end if;
    end if;
  end if;

  if not p_clear_category and p_category_id is not null then
    if not exists (
      select 1 from public.categories where id = p_category_id and user_id = v_uid
    ) then
      raise exception 'Category not found or not owned by current user';
    end if;
  end if;

  -- 1) REVERSE old balance effect
  if v_old.type = 'income' then
    update public.accounts set balance = balance - v_old.amount, updated_at = now()
     where id = v_old.account_id and user_id = v_uid;

  elsif v_old.type = 'expense' then
    update public.accounts set balance = balance + v_old.amount, updated_at = now()
     where id = v_old.account_id and user_id = v_uid;

  elsif v_old.type = 'transfer' then
    update public.accounts set balance = balance + v_old.amount, updated_at = now()
     where id = v_old.account_id and user_id = v_uid;
    if v_old.transfer_peer_id is not null then
      update public.accounts set balance = balance - v_old.amount, updated_at = now()
       where id = v_old.transfer_peer_id and user_id = v_uid;
    end if;
  end if;

  -- 2) UPDATE the transaction row
  update public.transactions set
    account_id       = v_new_acct,
    type             = v_new_type,
    amount           = v_new_amt,
    date             = coalesce(p_date, v_old.date),
    description      = coalesce(p_description, v_old.description),
    category_id      = case
                         when v_new_type = 'transfer' then null
                         when p_clear_category         then null
                         when p_category_id is not null then p_category_id
                         else v_old.category_id
                       end,
    notes            = coalesce(p_notes, v_old.notes),
    transfer_peer_id = v_new_dst,
    is_neutral       = v_new_neutral,
    updated_at       = now()
  where id = p_transaction_id
  returning * into v_new;

  -- 3) APPLY new balance effect
  if v_new_type = 'income' then
    update public.accounts set balance = balance + v_new_amt, updated_at = now()
     where id = v_new_acct and user_id = v_uid;

  elsif v_new_type = 'expense' then
    update public.accounts set balance = balance - v_new_amt, updated_at = now()
     where id = v_new_acct and user_id = v_uid;

  elsif v_new_type = 'transfer' then
    update public.accounts set balance = balance - v_new_amt, updated_at = now()
     where id = v_new_acct and user_id = v_uid;
    update public.accounts set balance = balance + v_new_amt, updated_at = now()
     where id = v_new_dst and user_id = v_uid;
  end if;

  insert into public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  values (v_uid, 'UPDATE', 'transactions', v_new.id, to_jsonb(v_old), to_jsonb(v_new));

  return to_jsonb(v_new);
end;
$$;

-- ============================================================
-- 5. Re-apply grants (le funzioni sono state ricreate con nuova firma)
-- ============================================================
revoke execute on function public.create_transaction_atomic(uuid, text, numeric, date, text, uuid, text, uuid, uuid, boolean) from public, anon;
revoke execute on function public.update_transaction_atomic(uuid, uuid, text, numeric, date, text, uuid, text, uuid, boolean, boolean) from public, anon;

grant execute on function public.create_transaction_atomic(uuid, text, numeric, date, text, uuid, text, uuid, uuid, boolean) to authenticated;
grant execute on function public.update_transaction_atomic(uuid, uuid, text, numeric, date, text, uuid, text, uuid, boolean, boolean) to authenticated;
