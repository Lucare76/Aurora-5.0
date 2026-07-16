# Sprint 4 - Uso residuo di transfer_peer_id

## Sintesi

Sprint 4 ha eliminato la lettura diretta da settings CSV export e ha rimosso il filtro che escludeva movimenti con `transfer_peer_id`.

L'export ora passa da `AppTransaction`.

## Uso autorizzato

### Adapter e modello transfer

- `src/domain/accounting/transfer-model.ts`
- `src/domain/accounting/transaction-adapter.ts`

Motivo: sono i soli punti autorizzati a interpretare la semantica del campo DB.

### Select esplicite

I file applicativi selezionano ancora la colonna `transfer_peer_id` per poter costruire `AppTransaction`:

- `src/hooks/use-transactions.ts`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/reports/page.tsx`
- `src/app/(app)/transactions/page.tsx`
- `src/app/(app)/budgets/page.tsx`
- `src/app/(app)/settings/page.tsx`

Motivo: il campo e' ancora nello schema DB e serve all'adapter.

## Legacy residuo attivo

### Transactions page

- raccolta `peerIds`;
- fetch peer transaction;
- fallback edit per record legacy.

Motivo: supporto al vecchio modello a due righe. Non eliminabile senza refactor piu' ampio o schema normalizzato.

### Dashboard

- `TransactionIcon` usa ancora `transaction.transfer_peer_id`;
- budget alert query usa `.is('transfer_peer_id', null)`;
- fallback label ultimi movimenti.

Motivo: non toccato per evitare refactor UI/dashboard oltre scope. KPI e chart sono gia' centralizzati.

### Reports

- query YoY mantiene `.is('transfer_peer_id', null)`.

Motivo: preserva criterio storico e riduce dataset lato client; i calcoli successivi passano da `AppTransaction`.

## Rimosso in Sprint 4

### Settings export CSV

Prima:

- selezionava `transfer_peer_id`;
- filtrava `!t.transfer_peer_id`;
- perdeva transfer storici e nuovi.

Dopo:

- esporta tutte le transazioni;
- converte a `AppTransaction`;
- include classificazione transfer;
- include conto destinazione quando risolto.

## Test/fixture

Le occorrenze nei test e fixture sono intenzionali per coprire:

- modello storico;
- modello nuovo;
- record orphan/invalid;
- parita' legacy.

## Conclusione

Le letture dirette residue nel codice applicativo sono documentate come legacy inevitabile. La prossima riduzione significativa richiede normalizzazione DB o refactor della pagina transazioni/dashboard ultimi movimenti.
