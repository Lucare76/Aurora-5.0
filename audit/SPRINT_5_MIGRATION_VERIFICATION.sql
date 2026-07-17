-- Aurora 5.0 Sprint 5 migration verification queries.
-- Run only against a local Supabase database or a dedicated clone.

select
  'transactions_by_transfer_model' as check_name,
  transfer_model,
  count(*) as rows
from public.transactions
group by transfer_model
order by transfer_model;

select
  'orphan_transfer_references' as check_name,
  count(*) as rows
from public.transactions t
where t.transfer_peer_id is not null
  and not exists (
    select 1 from public.transactions peer
    where peer.id = t.transfer_peer_id and peer.user_id = t.user_id
  )
  and not exists (
    select 1 from public.accounts a
    where a.id = t.transfer_peer_id and a.user_id = t.user_id
  );

select
  'broken_destination_account_links' as check_name,
  count(*) as rows
from public.transactions t
left join public.accounts a
  on a.id = t.destination_account_id
 and a.user_id = t.user_id
where t.destination_account_id is not null
  and a.id is null;

select
  'broken_peer_transaction_links' as check_name,
  count(*) as rows
from public.transactions t
left join public.transactions peer
  on peer.id = t.peer_transaction_id
 and peer.user_id = t.user_id
where t.peer_transaction_id is not null
  and peer.id is null;

select
  'net_worth_by_user' as check_name,
  user_id,
  sum(balance)::numeric(15, 2) as net_worth
from public.accounts
where is_active = true
group by user_id
order by user_id;

select
  'monthly_income_expense' as check_name,
  user_id,
  to_char(date_trunc('month', date), 'YYYY-MM') as month,
  sum(case when type = 'income' and transfer_peer_id is null then amount else 0 end)::numeric(15, 2) as income,
  sum(case when type = 'expense' and transfer_peer_id is null then amount else 0 end)::numeric(15, 2) as expense
from public.transactions
group by user_id, date_trunc('month', date)
order by user_id, month;
