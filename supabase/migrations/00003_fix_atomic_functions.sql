-- Aurora 5.0 — Fix atomic financial functions
-- Fixes from financial audit:
--   B1: add user_id filter to all balance UPDATEs in create_transaction_atomic
--   B2: use IS DISTINCT FROM for NULL-safe comparison in update_transaction_atomic
--   C1: revoke adjust_account_balance from authenticated (prevent direct balance manipulation)

-- ============================================================
-- 1. FIX create_transaction_atomic — add user_id to balance UPDATEs
-- ============================================================
create or replace function public.create_transaction_atomic(
  p_account_id          uuid,
  p_type                text,
  p_amount              numeric,
  p_date                date,
  p_description         text       default null,
  p_category_id         uuid       default null,
  p_notes               text       default null,
  p_destination_account_id uuid    default null,
  p_recurring_id        uuid       default null
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
    transfer_peer_id, recurring_id
  ) values (
    v_uid, p_account_id, p_type, p_amount, p_date,
    p_description,
    case when p_type = 'transfer' then null else p_category_id end,
    p_notes,
    case when p_type = 'transfer' then p_destination_account_id else null end,
    p_recurring_id
  )
  returning * into v_tx;

  -- FIX B1: all balance UPDATEs now filter by user_id
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
-- 2. FIX update_transaction_atomic — NULL-safe destination comparison
-- ============================================================
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
  p_clear_category        boolean    default false
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
    -- FIX B2: use IS DISTINCT FROM for NULL-safe comparison
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
-- 3. FIX C1: lock down adjust_account_balance
-- ============================================================
-- The DB may have this function with parameter named p_delta or p_amount.
-- DROP both possible signatures, then recreate with no external grants.
drop function if exists public.adjust_account_balance(uuid, numeric);

create or replace function public.adjust_account_balance(
  p_account_id uuid,
  p_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
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

-- No role should call this directly — it is only used internally
revoke execute on function public.adjust_account_balance(uuid, numeric) from public, anon, authenticated;


-- ============================================================
-- 4. Re-apply grants (functions were replaced via CREATE OR REPLACE)
-- ============================================================
revoke execute on function public.create_transaction_atomic(uuid, text, numeric, date, text, uuid, text, uuid, uuid) from public, anon;
revoke execute on function public.update_transaction_atomic(uuid, uuid, text, numeric, date, text, uuid, text, uuid, boolean) from public, anon;

grant execute on function public.create_transaction_atomic(uuid, text, numeric, date, text, uuid, text, uuid, uuid) to authenticated;
grant execute on function public.update_transaction_atomic(uuid, uuid, text, numeric, date, text, uuid, text, uuid, boolean) to authenticated;
