# Sprint 4 - Piano migrazione DB futura transfer

## Obiettivo

Normalizzare il modello dei giroconti rimuovendo la doppia semantica di `transactions.transfer_peer_id`.

Questo documento e' solo un piano. Nessuna migration e' stata creata o eseguita in Sprint 4.

## Schema target

Opzione consigliata:

```sql
alter table public.transactions
  add column destination_account_id uuid null references public.accounts(id) on delete set null,
  add column peer_transaction_id uuid null references public.transactions(id) on delete set null,
  add column transfer_model text null;
```

Valori `transfer_model`:

- `none`
- `destination_account`
- `peer_transaction`
- `ambiguous`
- `orphan`
- `invalid`

In fase finale, aggiungere CHECK constraint.

## Strategia per 170 record storici

1. Backup completo tabelle:
   - `transactions`;
   - `accounts`;
   - `audit_logs`.
2. Dry-run classificazione:
   - join `transactions.transfer_peer_id` verso `transactions.id`;
   - join `transactions.transfer_peer_id` verso `accounts.id`;
   - classificazione equivalente a `classifyTransferReference`.
3. Per record peer transaction validi:
   - `peer_transaction_id = transfer_peer_id`;
   - `destination_account_id = peer.account_id`;
   - `transfer_model = 'peer_transaction'`.
4. Per record non reciproci/importo diverso/owner diverso:
   - `transfer_model = 'invalid'`;
   - non modificare effetti contabili automaticamente.

## Strategia per 2 record nuovi

Per record dove `transfer_peer_id` punta a `accounts.id`:

- `destination_account_id = transfer_peer_id`;
- `peer_transaction_id = null`;
- `transfer_model = 'destination_account'`.

## Backup

Prima della migration:

```sql
create table backup_transactions_before_transfer_migration as
select * from public.transactions;
```

Se possibile, esportare anche dump Supabase/Postgres esterno.

## Dry-run query

Esempio:

```sql
select
  t.id,
  t.type,
  t.amount,
  t.account_id,
  t.transfer_peer_id,
  peer.id as peer_transaction_id,
  peer.account_id as peer_account_id,
  dest.id as destination_account_id,
  case
    when t.transfer_peer_id is null then 'none'
    when peer.id is not null and dest.id is not null then 'ambiguous'
    when peer.id is not null and peer.transfer_peer_id = t.id and peer.amount = t.amount then 'peer_transaction'
    when dest.id is not null and dest.id <> t.account_id then 'destination_account'
    when peer.id is null and dest.id is null then 'orphan'
    else 'invalid'
  end as classification
from public.transactions t
left join public.transactions peer on peer.id = t.transfer_peer_id
left join public.accounts dest on dest.id = t.transfer_peer_id
where t.transfer_peer_id is not null;
```

## Verifiche post-migration

- Conteggio totale transazioni invariato.
- Somma saldi conti invariata.
- Totali mensili income/expense/net invariati.
- Numero record classificati uguale al dry-run.
- Nessun `destination_account_id = account_id`.
- Nessun peer non reciproco classificato come valido.

## Rollback

Rollback logico:

```sql
update public.transactions t
set transfer_peer_id = b.transfer_peer_id
from backup_transactions_before_transfer_migration b
where b.id = t.id;
```

Rollback strutturale:

```sql
alter table public.transactions
  drop column if exists destination_account_id,
  drop column if exists peer_transaction_id,
  drop column if exists transfer_model;
```

## Compatibilita temporanea

Per 1-2 sprint:

- scrivere sia `transfer_peer_id` sia `destination_account_id`;
- leggere preferendo i nuovi campi;
- fallback su `transfer_peer_id` tramite adapter.

## Rimozione futura

Dopo verifica:

1. aggiornare RPC per usare `destination_account_id`;
2. aggiornare tipi DB;
3. migrare UI/API;
4. rimuovere fallback adapter;
5. deprecare o rimuovere `transfer_peer_id`.

## Rischio

Rischio alto: campo storicamente ambiguo e impatto su saldi.

La migration va eseguita solo dopo test di integrazione su DB clone/locale e confronto completo con NotaFacile.
