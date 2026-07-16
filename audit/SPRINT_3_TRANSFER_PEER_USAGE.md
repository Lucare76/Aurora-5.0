# Sprint 3 - Uso residuo di transfer_peer_id

## Sintesi

Sprint 3 riduce le letture dirette nei calcoli principali, ma non elimina fisicamente `transfer_peer_id` dal codice perche' resta parte dello schema DB e delle RPC correnti.

Nuovo codice autorizzato a interpretare il campo:

- `src/domain/accounting/transfer-model.ts`
- `src/domain/accounting/transaction-adapter.ts`

## DB type

- `src/types/database.ts`
  - campo `Transaction.transfer_peer_id`;
  - tipi `Database.public.Tables.transactions.Row/Insert/Update`.

Motivo: rappresentazione dello schema DB corrente. Non modificato.

## Migration / RPC

- `supabase/migrations/00001_initial_schema.sql`
- `supabase/migrations/00002_financial_atomic_functions.sql`
- `supabase/migrations/00003_fix_atomic_functions.sql`
- `supabase/migrations/00009_fix_transfer_peer_id_fkey.sql`

Motivo: storico schema/RPC. Non modificato per vincolo Sprint 3.

## Adapter e modello dominio

- `src/domain/accounting/transfer-model.ts`
- `src/domain/accounting/transaction-adapter.ts`

Classificazione: uso autorizzato.

Responsabilita':

- classificare `transfer_peer_id`;
- distinguere `peer_transaction`, `destination_account`, `ambiguous`, `orphan`, `invalid`, `none`;
- esporre `AppTransaction` camelCase.

## Test e fixture

- `src/domain/accounting/transfer-model.test.ts`
- `src/domain/accounting/transaction-adapter.test.ts`
- `src/domain/accounting/aggregations.test.ts`
- `tests/fixtures/accounting-fixture.ts`
- `tests/fixtures/accounting-rich-fixture.ts`

Classificazione: uso autorizzato per test legacy/parita'.

## Codice legacy ancora attivo

### Transactions page

- `src/app/(app)/transactions/page.tsx`

Occorrenze residue:

- raccolta `peerIds`;
- fetch peer transaction;
- fallback edit per record legacy;
- adapter context.

Motivo: la pagina deve ancora supportare il vecchio modello a peer transaction. L'adozione di `AppTransaction` e' iniziata per totali e display transfer, ma il fetch peer resta necessario finche' la pagina non sara' rifattorizzata.

### Dashboard

- `src/app/(app)/dashboard/page.tsx`

Occorrenze residue:

- `TransactionIcon`;
- query budget mensile con `.is('transfer_peer_id', null)`;
- fallback descrizione ultimi movimenti.

Motivo: KPI e chart sono migrati verso funzioni centralizzate; budget alert e ultime transazioni restano legacy per evitare refactor UI ampio.

### Reports

- `src/app/(app)/reports/page.tsx`

Occorrenze residue:

- query YoY filtrata lato DB con `.is('transfer_peer_id', null)`.

Motivo: la tabella YoY usa ora `AppTransaction` nei calcoli, ma la query mantiene il filtro legacy per ridurre dataset e preservare comportamento.

### Settings

- `src/app/(app)/settings/page.tsx`

Occorrenze residue:

- export CSV seleziona `transfer_peer_id`;
- export CSV filtra righe con peer.

Motivo: fuori scope Sprint 3, da migrare in uno sprint export/settings.

## Codice nuovo da migrare in futuro

- `src/domain/accounting/calculations.ts`

Motivo: modulo Sprint 1 ancora basato su fixture pre-AppTransaction. Da deprecare o convertire in wrapper verso `aggregations.ts`.

## Conclusione

Le nuove funzioni contabili non interpretano direttamente `transfer_peer_id`. La semantica passa da `AppTransaction.transferReferenceKind`.

Le letture residue sono legacy, DB/migration, test o adapter. La rimozione completa richiede Sprint successivo su pagina transazioni, dashboard ultimi movimenti, settings export e futura migration.
