# Sprint 3 - Query audit

## Ambito

Analisi mirata alle query dashboard/report/transazioni/budget dopo la centralizzazione calcoli.

Non sono state introdotte React Query/SWR, aggregazioni server-side o refactor radicali.

## Query con `select('*')`

### `src/hooks/use-transactions.ts`

- Query: `transactions.select('*')`
- Uso: hook generico per lista e totali.
- Colonne realmente necessarie per calcoli: `id`, `user_id`, `account_id`, `category_id`, `type`, `amount`, `date`, `transfer_peer_id`, `created_at`, `updated_at`.
- Colonne extra spesso non necessarie: `notes`, `receipt_url`, `receipt_data`, `recurring_id`.
- Raccomandazione: creare variante `useTransactionSummaries` per dashboard/report.

### `src/app/(app)/dashboard/page.tsx`

- Query chart: `transactions.select('*')`
- Uso: conversione ad `AppTransaction` e aggregazione ultimi 6 mesi.
- Colonne realmente necessarie: stesse colonne minime sopra.
- Raccomandazione: sostituire con select esplicita o endpoint aggregato server-side.

### `src/app/(app)/reports/page.tsx`

- Query periodo: `transactions.select('*')`
- Query YoY: `transactions.select('*')`
- Uso: report, export e categorie.
- Colonne realmente necessarie: `id`, `user_id`, `account_id`, `category_id`, `type`, `amount`, `description`, `date`, `transfer_peer_id`, `created_at`, `updated_at`.
- Raccomandazione: select esplicita; in futuro aggregazioni SQL per periodi lunghi.

### `src/app/(app)/transactions/page.tsx`

- Query lista: `transactions.select('*')`
- Query peer: `transactions.select('*')`
- Query singolo peer: `transactions.select('*')`
- Uso: CRUD/lista completa.
- Colonne realmente necessarie: quasi tutte, tranne ricevute se non mostrate.
- Raccomandazione: mantenibile nel breve; separare lista compact da dettaglio transazione.

### `src/app/(app)/budgets/page.tsx`

- Query budget: `budgets.select('*')`
- Query transactions: `transactions.select('*')`
- Uso: budget list e speso categoria.
- Colonne realmente necessarie transactions: `id`, `user_id`, `account_id`, `category_id`, `type`, `amount`, `date`, `transfer_peer_id`, `created_at`, `updated_at`.
- Raccomandazione: select esplicita e calcolo server-side per storico grande.

## Query duplicate

- Dashboard usa `useTransactions` per mese corrente, mese precedente e ultimi movimenti, piu' query separata per chart.
- Reports carica periodo principale e YoY separatamente.
- Transactions carica lista e poi peer transaction in query separata.
- Budgets ricarica transazioni del mese separatamente da dashboard.

## Possibili aggregazioni server-side future

- Totali mensili per utente.
- Totali per categoria con rollup parent.
- Chart ultimi 6/12 mesi.
- Budget spent per categoria/mese.
- Net worth snapshot.

## Dataset caricati inutilmente

- `receipt_data` e `receipt_url` non servono per dashboard/report/budget.
- `notes` non serve per dashboard KPI/chart.
- `recurring_id` spesso non serve nei report aggregati.

## Conclusione

Le query restano funzionanti e compatibili, ma non sono ancora ottimizzate per 100k+ transazioni. Sprint 3 centralizza la logica client; lo step successivo naturale e' ridurre payload e spostare aggregazioni pesanti lato server/Postgres.
