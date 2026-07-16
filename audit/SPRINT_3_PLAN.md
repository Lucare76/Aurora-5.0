# Sprint 3 - Piano

## Obiettivo

Centralizzare i calcoli contabili di Aurora 5.0 su `AppTransaction` e funzioni pure, mantenendo invariati i risultati visibili e senza modificare dati, schema, migration o RPC.

## Logiche duplicate trovate

- Entrate mensili: `use-transactions`, dashboard, report, pagina transazioni.
- Uscite mensili: `use-transactions`, dashboard, report, budget, pagina transazioni.
- Netto: dashboard, report, pagina transazioni.
- Esclusione transfer: ripetuta come `!transfer_peer_id` in hook, report, dashboard, budget, transactions.
- Rollup categoria padre/sottocategoria: report, budget, modulo `calculations.ts`.
- Aggregazione mensile: dashboard chart, report time series, test contabili.
- Patrimonio totale: `useAccounts`/dashboard, da formalizzare come funzione pura.

## File da modificare

- `src/domain/accounting/transaction-adapter.ts`
- `src/domain/accounting/aggregations.ts` nuovo
- `src/domain/accounting/aggregations.test.ts` nuovo
- `tests/fixtures/accounting-rich-fixture.ts` nuovo
- `src/hooks/use-transactions.ts`
- `src/app/(app)/reports/page.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/transactions/page.tsx`
- `src/app/(app)/budgets/page.tsx`
- documenti audit Sprint 3

## Funzioni da centralizzare

- `calculateIncomeTotal`
- `calculateExpenseTotal`
- `calculateNetTotal`
- `calculateTransferTotal`
- `calculateAccountBalance`
- `calculateAccountBalances`
- `calculateNetWorth`
- `filterTransactionsByDateRange`
- `groupTransactionsByMonth`
- `calculateMonthlyTotals`
- `calculateCategoryTotals`
- `rollupToParentCategory`

## Letture dirette `transfer_peer_id`

Punti attivi da migrare o documentare:

- `src/hooks/use-transactions.ts`: totali mensili.
- `src/app/(app)/reports/page.tsx`: filtri, serie temporale, export.
- `src/app/(app)/dashboard/page.tsx`: icona ultime transazioni, budget query, chart query.
- `src/app/(app)/transactions/page.tsx`: fetch peer, edit transfer, totali, display transfer.
- `src/app/(app)/budgets/page.tsx`: speso per categoria.

Punti da lasciare:

- tipi DB;
- migration;
- adapter;
- test che verificano compatibilita legacy.

## Rischi per modifica

- Hook transazioni: rischio basso, perche' mantiene `transactions` raw e aggiunge/usa `adaptedTransactions`.
- Report: rischio medio, perche' sostituisce calcoli aggregati ma non layout/query.
- Dashboard: rischio medio, soprattutto chart sei mesi; verra' usata la stessa regola di neutralita transfer.
- Transactions page: rischio alto se refactor massivo; quindi solo adozione minima per totali/display transfer.
- Budgets: rischio basso/medio, solo calcolo speso per categoria.

## Criteri per dimostrare che i totali non cambiano

- Test di parita' tra vecchie formule `type === income/expense && !transfer_peer_id` e nuove funzioni su fixture.
- Test fixture multi-anno con transfer storico e nuovo.
- Test su mesi positivi/negativi, fine anno e anno bisestile.
- `npm run test:run` con almeno 70 test.
- `npm run test:coverage` non inferiore allo Sprint 2.
- `npm run build` verde.

## Limite esplicito

Non si modifica lo schema fisico di `transfer_peer_id`. La centralizzazione applicativa riduce le letture dirette, ma la rimozione dell'ambiguita a livello DB resta lavoro futuro.
