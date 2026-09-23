-- Divide una spesa già registrata in quota rimborsata e quota personale.
-- La somma dei due movimenti è identica all'uscita originale: il saldo del conto
-- non viene modificato. Il rimborso bancario resta un movimento separato.
create or replace function public.split_reimbursed_expense(p_transaction_id uuid, p_reimbursed_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction public.transactions%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_transaction from public.transactions
    where id = p_transaction_id and user_id = auth.uid() for update;
  if not found then raise exception 'Transaction not found'; end if;
  if v_transaction.type <> 'expense' or v_transaction.is_neutral
     or v_transaction.transfer_peer_id is not null then
    raise exception 'Only regular expenses can be split';
  end if;
  if p_reimbursed_amount is null or p_reimbursed_amount <> round(p_reimbursed_amount, 2)
     or p_reimbursed_amount <= 0 or p_reimbursed_amount >= v_transaction.amount then
    raise exception 'Reimbursement must be positive and less than expense';
  end if;

  update public.transactions set amount = p_reimbursed_amount, is_neutral = true
    where id = p_transaction_id and user_id = auth.uid();
  insert into public.transactions
    (user_id, account_id, category_id, type, amount, description, notes, date, is_neutral)
  values
    (v_transaction.user_id, v_transaction.account_id, v_transaction.category_id,
     'expense', v_transaction.amount - p_reimbursed_amount,
     v_transaction.description, 'Quota personale della spesa anticipata. ' || coalesce(v_transaction.notes, ''),
     v_transaction.date, false);
end;
$$;

revoke all on function public.split_reimbursed_expense(uuid, numeric) from public, anon;
grant execute on function public.split_reimbursed_expense(uuid, numeric) to authenticated;
