-- Hardening riconciliazione -> Patrimonio
-- Rende atomici: creazione riconciliazione, aggiornamento eventuale asset 1:1
-- e snapshot del singolo asset. Lo snapshot consolidato del Patrimonio resta
-- applicativo perché dipende dalla vista finanziaria complessiva.

create or replace function public.create_reconciliation_atomic(
  p_account_id uuid,
  p_statement_date date,
  p_bank_balance numeric,
  p_source_type text default 'manual',
  p_source_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_account_balance numeric(15,2);
  v_status text;
  v_reconciliation public.account_reconciliations%rowtype;
  v_asset_count integer := 0;
  v_asset_id uuid;
  v_asset_value numeric(15,2);
  v_observed_at timestamptz;
  v_patrimonio_sync text := 'skipped';
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_source_type not in ('manual', 'import') then
    raise exception 'Invalid reconciliation source type';
  end if;

  if p_statement_date is null or p_bank_balance is null then
    raise exception 'Statement date and bank balance are required';
  end if;

  select balance
    into v_account_balance
    from public.accounts
   where id = p_account_id
     and user_id = v_uid
   for update;

  if not found then
    raise exception 'Account not found or not owned by current user';
  end if;

  v_status := case
    when round(p_bank_balance - v_account_balance, 2) = 0 then 'reconciled'
    else 'mismatch'
  end;

  insert into public.account_reconciliations (
    user_id,
    account_id,
    statement_date,
    bank_balance,
    app_balance_snapshot,
    status,
    source_type,
    source_reference,
    reconciled_at
  ) values (
    v_uid,
    p_account_id,
    p_statement_date,
    round(p_bank_balance, 2),
    v_account_balance,
    v_status,
    p_source_type,
    p_source_reference,
    case when v_status = 'reconciled' then now() else null end
  )
  returning * into v_reconciliation;

  -- L'AFTER INSERT che gestisce le riconciliazioni retroattive può aver
  -- modificato lo stato della riga appena creata. Rileggiamola prima di
  -- restituirla al client.
  select *
    into v_reconciliation
    from public.account_reconciliations
   where id = v_reconciliation.id;

  select count(*), min(id)
    into v_asset_count, v_asset_id
    from (
      select id
        from public.external_assets
       where user_id = v_uid
         and linked_account_id = p_account_id
       order by id
       limit 2
    ) candidates;

  if v_asset_count = 1 then
    select current_value
      into v_asset_value
      from public.external_assets
     where id = v_asset_id
       and user_id = v_uid
     for update;

    if round(p_bank_balance - coalesce(v_asset_value, 0), 2) = 0 then
      v_patrimonio_sync := 'unchanged';
    else
      v_observed_at := (p_statement_date::timestamp + time '12:00:00') at time zone 'UTC';

      update public.external_assets
         set current_value = round(p_bank_balance, 2),
             observed_at = v_observed_at,
             updated_at = now()
       where id = v_asset_id
         and user_id = v_uid;

      insert into public.external_asset_snapshots (
        user_id,
        asset_id,
        current_value,
        linked_account_balance,
        observed_at
      ) values (
        v_uid,
        v_asset_id,
        round(p_bank_balance, 2),
        v_account_balance,
        v_observed_at
      );

      v_patrimonio_sync := 'updated';
    end if;
  end if;

  return jsonb_build_object(
    'reconciliation', to_jsonb(v_reconciliation),
    'patrimonio_sync', v_patrimonio_sync,
    'observed_at', case when v_observed_at is null then null else to_jsonb(v_observed_at) end
  );
end;
$$;

revoke all on function public.create_reconciliation_atomic(uuid, date, numeric, text, text) from public, anon;
grant execute on function public.create_reconciliation_atomic(uuid, date, numeric, text, text) to authenticated;
