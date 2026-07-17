-- Aurora 5.0 Sprint 5
-- DRY-RUN ONLY: transfer model normalization draft.
--
-- This file is intentionally placed in supabase/migrations_draft/ and must not
-- be applied automatically by Supabase CLI or deployment pipelines.
--
-- Goal:
-- - replace the overloaded transactions.transfer_peer_id meaning with:
--   - destination_account_id for one-row transfers;
--   - peer_transaction_id for legacy two-row transfers.
--
-- Local-only dry run:
--   psql "$SUPABASE_LOCAL_DB_URL" -f supabase/migrations_draft/00011_normalize_transfer_model_dry_run.sql

begin;

alter table public.transactions
  add column if not exists destination_account_id uuid null references public.accounts(id) on delete set null,
  add column if not exists peer_transaction_id uuid null references public.transactions(id) on delete set null,
  add column if not exists transfer_model text not null default 'none';

update public.transactions t
set
  destination_account_id = case
    when t.type = 'transfer'
     and t.transfer_peer_id is not null
     and exists (
       select 1
       from public.accounts a
       where a.id = t.transfer_peer_id
         and a.user_id = t.user_id
     )
    then t.transfer_peer_id
    else t.destination_account_id
  end,
  transfer_model = case
    when t.type = 'transfer'
     and t.transfer_peer_id is not null
     and exists (
       select 1
       from public.accounts a
       where a.id = t.transfer_peer_id
         and a.user_id = t.user_id
     )
    then 'destination_account'
    else t.transfer_model
  end;

update public.transactions t
set
  peer_transaction_id = t.transfer_peer_id,
  transfer_model = 'peer_transaction'
where t.transfer_peer_id is not null
  and exists (
    select 1
    from public.transactions peer
    where peer.id = t.transfer_peer_id
      and peer.user_id = t.user_id
      and peer.transfer_peer_id = t.id
  );

update public.transactions
set transfer_model = 'none'
where transfer_peer_id is null
  and coalesce(transfer_model, 'none') = 'none';

update public.transactions
set transfer_model = 'orphan'
where transfer_peer_id is not null
  and destination_account_id is null
  and peer_transaction_id is null;

create index if not exists idx_transactions_destination_account
  on public.transactions(destination_account_id)
  where destination_account_id is not null;

create index if not exists idx_transactions_peer_transaction
  on public.transactions(peer_transaction_id)
  where peer_transaction_id is not null;

alter table public.transactions
  add constraint transactions_transfer_model_check
  check (transfer_model in ('none', 'destination_account', 'peer_transaction', 'orphan'));

-- Dry-run verification queries. They intentionally return result sets instead
-- of mutating more data, so the operator can inspect them before commit.
select transfer_model, count(*) as transactions
from public.transactions
group by transfer_model
order by transfer_model;

select count(*) as orphan_transfers
from public.transactions
where transfer_model = 'orphan';

select count(*) as broken_destination_accounts
from public.transactions t
left join public.accounts a on a.id = t.destination_account_id and a.user_id = t.user_id
where t.destination_account_id is not null
  and a.id is null;

select count(*) as broken_peer_links
from public.transactions t
left join public.transactions peer on peer.id = t.peer_transaction_id and peer.user_id = t.user_id
where t.peer_transaction_id is not null
  and peer.id is null;

-- Keep this transaction open until verification is reviewed.
-- For local dry run, use COMMIT only after the verification queries are clean.
-- For rehearsal without persistence, leave ROLLBACK.
rollback;
