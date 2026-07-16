# Sprint 3 - Fonte unica di verita contabile

## Moduli canonici

Da Sprint 3, i nuovi calcoli applicativi devono usare:

- `src/domain/accounting/transaction-adapter.ts`
- `src/domain/accounting/transfer-model.ts`
- `src/domain/accounting/aggregations.ts`

## AppTransaction

`AppTransaction` e' il modello applicativo camelCase derivato da `Transaction` DB.

Espone:

- `id`
- `userId`
- `date`
- `type`
- `amount`
- `description`
- `accountId`
- `categoryId`
- `transferReferenceKind`
- `destinationAccountId`
- `peerTransactionId`
- `createdAt`
- `updatedAt`

Il tipo DB resta separato.

## Funzioni fonte unica

Totali:

- `calculateIncomeTotal`
- `calculateExpenseTotal`
- `calculateNetTotal`
- `calculateTransferTotal`

Patrimonio:

- `calculateAccountBalance`
- `calculateAccountBalances`
- `calculateNetWorth`

Periodi:

- `filterTransactionsByDateRange`
- `groupTransactionsByMonth`
- `calculateMonthlyTotals`

Categorie:

- `calculateCategoryTotals`
- `rollupToParentCategory`

Predicate:

- `isCountableIncome`
- `isCountableExpense`
- `isValidTransfer`

## Pagine migrate

### Reports

Migrati:

- entrate;
- uscite;
- netto;
- categorie;
- serie temporale;
- export CSV del report.

### Dashboard

Migrati:

- KPI mese tramite `useTransactions`;
- patrimonio totale tramite `calculateNetWorth`;
- chart ultimi 6 mesi tramite `calculateMonthlyTotals`.

### Transactions

Migrati:

- totali mese;
- netto mese;
- display transfer con `AppTransaction.destinationAccountId` dove disponibile;
- edit transfer usa destinazione classificata quando disponibile.

### Budgets

Migrato:

- speso per categoria usa `AppTransaction` e `isCountableExpense`.

## Regole transfer

- Income/expense senza riferimento: contano in entrate/uscite/netto.
- Transfer storico peer transaction: non conta in entrate/uscite/netto.
- Transfer nuovo destination account: non conta in entrate/uscite/netto.
- Transfer valido conta in `calculateTransferTotal`.
- Peer storico viene contato una sola volta nel totale transfer.
- `ambiguous`, `orphan`, `invalid`: non contano come transfer valido.

## Record invalidi

I record invalidi sono esclusi dai calcoli transfer e non vengono interpretati come destinazioni. Per i totali income/expense, la regola rimane equivalente al comportamento legacy: solo record senza riferimento transfer contano.

## Come aggiungere nuovi calcoli

1. Convertire le righe DB in `AppTransaction` tramite adapter.
2. Aggiungere una funzione pura in `aggregations.ts`.
3. Coprire con fixture realistica.
4. Aggiungere test di parita' se sostituisce una formula legacy.
5. Usare la funzione nelle pagine, evitando query o React nel modulo dominio.

## Parti ancora legacy

- `src/domain/accounting/calculations.ts` resta modulo Sprint 1.
- Dashboard ultimi movimenti usa ancora alcuni fallback raw.
- Query budget dashboard usa filtro DB su `transfer_peer_id`.
- Settings export resta fuori scope.
- Pagina transazioni mantiene fetch peer legacy per compatibilita'.
