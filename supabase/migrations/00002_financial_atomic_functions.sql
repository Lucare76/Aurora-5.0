-- Aurora 5.0 — Atomic Financial Functions
--
-- Every financial mutation (create / update / delete transaction) runs inside
-- a single PL/pgSQL function call.  Because Postgres wraps each function
-- invocation in an implicit transaction, either ALL writes succeed or NONE
-- do — there is no window where a transaction row exists but the account
-- balance is stale, or vice versa.
--
-- All functions use auth.uid() to identify the caller and never trust a
-- user_id coming from the client.  They are SECURITY DEFINER so they can
-- write to audit_logs (which has no INSERT policy for regular users) while
-- still checking ownership explicitly.
--
-- Permissions: only the `authenticated` role may call these functions.

-- ============================================================
-- 1. CREATE TRANSACTION (atomic)
-- ============================================================
create or replace function public.create_transaction_atomic(
  p_account_id          uuid,
  p_type                text,        -- 'income' | 'expense' | 'transfer'
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
  -- ---- validate type --------------------------------------------------
  if p_type not in ('income', 'expense', 'transfer') then
    raise exception 'Invalid transaction type: %', p_type;
  end if;

  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  -- ---- validate source account ownership ------------------------------
  select user_id into v_src_owner
    from public.accounts
   where id = p_account_id;

  if v_src_owner is null then
    raise exception 'Source account not found';
  end if;
  if v_src_owner <> v_uid then
    raise exception 'Source account not owned by current user';
  end if;

  -- ---- transfer-specific checks --------------------------------------
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

  -- ---- validate category ownership (if provided) ----------------------
  if p_category_id is not null then
    if not exists (
      select 1 from public.categories
       where id = p_category_id and user_id = v_uid
    ) then
      raise exception 'Category not found or not owned by current user';
    end if;
  end if;

  -- ---- insert transaction ---------------------------------------------
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

  -- ---- update account balances ----------------------------------------
  if p_type = 'income' then
    update public.accounts
       set balance = balance + p_amount, updated_at = now()
     where id = p_account_id;

  elsif p_type = 'expense' then
    update public.accounts
       set balance = balance - p_amount, updated_at = now()
     where id = p_account_id;

  elsif p_type = 'transfer' then
    update public.accounts
       set balance = balance - p_amount, updated_at = now()
     where id = p_account_id;

    update public.accounts
       set balance = balance + p_amount, updated_at = now()
     where id = p_destination_account_id;
  end if;

  -- ---- audit log ------------------------------------------------------
  insert into public.audit_logs (user_id, action, table_name, record_id, new_data)
  values (v_uid, 'CREATE', 'transactions', v_tx.id, to_jsonb(v_tx));

  -- ---- return the created row as JSON ---------------------------------
  return to_jsonb(v_tx);
end;
$$;


-- ============================================================
-- 2. DELETE TRANSACTION (atomic)
-- ============================================================
create or replace function public.delete_transaction_atomic(
  p_transaction_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tx  public.transactions%rowtype;
begin
  -- ---- fetch and verify ownership -------------------------------------
  select * into v_tx
    from public.transactions
   where id = p_transaction_id;

  if v_tx.id is null then
    raise exception 'Transaction not found';
  end if;
  if v_tx.user_id <> v_uid then
    raise exception 'Transaction not owned by current user';
  end if;

  -- ---- reverse the balance effect -------------------------------------
  if v_tx.type = 'income' then
    update public.accounts
       set balance = balance - v_tx.amount, updated_at = now()
     where id = v_tx.account_id and user_id = v_uid;

  elsif v_tx.type = 'expense' then
    update public.accounts
       set balance = balance + v_tx.amount, updated_at = now()
     where id = v_tx.account_id and user_id = v_uid;

  elsif v_tx.type = 'transfer' then
    -- give back to source
    update public.accounts
       set balance = balance + v_tx.amount, updated_at = now()
     where id = v_tx.account_id and user_id = v_uid;

    -- take back from destination
    if v_tx.transfer_peer_id is not null then
      update public.accounts
         set balance = balance - v_tx.amount, updated_at = now()
       where id = v_tx.transfer_peer_id and user_id = v_uid;
    end if;
  end if;

  -- ---- delete ---------------------------------------------------------
  delete from public.transactions where id = p_transaction_id;

  -- ---- audit log ------------------------------------------------------
  insert into public.audit_logs (user_id, action, table_name, record_id, old_data)
  values (v_uid, 'DELETE', 'transactions', v_tx.id, to_jsonb(v_tx));
end;
$$;


-- ============================================================
-- 3. UPDATE TRANSACTION (atomic)
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
  -- ---- fetch old row and verify ownership -----------------------------
  select * into v_old
    from public.transactions
   where id = p_transaction_id;

  if v_old.id is null then
    raise exception 'Transaction not found';
  end if;
  if v_old.user_id <> v_uid then
    raise exception 'Transaction not owned by current user';
  end if;

  -- ---- resolve effective new values (coalesce with old) ---------------
  v_new_acct := coalesce(p_account_id,  v_old.account_id);
  v_new_type := coalesce(p_type,        v_old.type);
  v_new_amt  := coalesce(p_amount,      v_old.amount);
  v_new_dst  := case
                  when v_new_type = 'transfer'
                    then coalesce(p_destination_account_id, v_old.transfer_peer_id)
                  else null
                end;

  -- ---- validate new values --------------------------------------------
  if v_new_type not in ('income', 'expense', 'transfer') then
    raise exception 'Invalid transaction type: %', v_new_type;
  end if;
  if v_new_amt <= 0 then
    raise exception 'Amount must be positive';
  end if;

  -- validate new source account ownership
  if v_new_acct <> v_old.account_id then
    select user_id into v_owner from public.accounts where id = v_new_acct;
    if v_owner is null or v_owner <> v_uid then
      raise exception 'New source account not found or not owned by current user';
    end if;
  end if;

  -- validate transfer destination
  if v_new_type = 'transfer' then
    if v_new_dst is null then
      raise exception 'Destination account is required for transfers';
    end if;
    if v_new_acct = v_new_dst then
      raise exception 'Source and destination accounts must differ';
    end if;
    if v_new_dst <> v_old.transfer_peer_id or v_old.transfer_peer_id is null then
      select user_id into v_owner from public.accounts where id = v_new_dst;
      if v_owner is null or v_owner <> v_uid then
        raise exception 'New destination account not found or not owned by current user';
      end if;
    end if;
  end if;

  -- validate category ownership
  if not p_clear_category and p_category_id is not null then
    if not exists (
      select 1 from public.categories where id = p_category_id and user_id = v_uid
    ) then
      raise exception 'Category not found or not owned by current user';
    end if;
  end if;

  -- ---- 1) REVERSE old balance effect ----------------------------------
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

  -- ---- 2) UPDATE the transaction row ----------------------------------
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

  -- ---- 3) APPLY new balance effect ------------------------------------
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

  -- ---- audit log ------------------------------------------------------
  insert into public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  values (v_uid, 'UPDATE', 'transactions', v_new.id, to_jsonb(v_old), to_jsonb(v_new));

  return to_jsonb(v_new);
end;
$$;


-- ============================================================
-- 4. PERMISSIONS
-- ============================================================

-- Revoke execute from public/anon on all three functions
revoke execute on function public.create_transaction_atomic(uuid, text, numeric, date, text, uuid, text, uuid, uuid) from public, anon;
revoke execute on function public.delete_transaction_atomic(uuid) from public, anon;
revoke execute on function public.update_transaction_atomic(uuid, uuid, text, numeric, date, text, uuid, text, uuid, boolean) from public, anon;

-- Grant only to authenticated users
grant execute on function public.create_transaction_atomic(uuid, text, numeric, date, text, uuid, text, uuid, uuid) to authenticated;
grant execute on function public.delete_transaction_atomic(uuid) to authenticated;
grant execute on function public.update_transaction_atomic(uuid, uuid, text, numeric, date, text, uuid, text, uuid, boolean) to authenticated;

-- Also lock down the old helper so it cannot be called directly anymore
revoke execute on function public.adjust_account_balance(uuid, numeric) from public, anon;
grant execute on function public.adjust_account_balance(uuid, numeric) to authenticated;
