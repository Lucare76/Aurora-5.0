# Sprint 4 - Query changes

## Query ottimizzate

### `src/hooks/use-transactions.ts`

Prima:

- `transactions.select('*')`

Dopo:

- `transactions.select('id,user_id,account_id,category_id,type,amount,description,notes,date,transfer_peer_id,recurring_id,receipt_url,receipt_data,created_at,updated_at')`

Motivo: il hook deve ancora restituire `Transaction` completo per lista e adapter, ma non usa wildcard.

### `src/app/(app)/dashboard/page.tsx`

Prima:

- chart ultimi 6 mesi con `transactions.select('*')`

Dopo:

- select esplicita delle colonne note della transazione.

Motivo: mantiene compatibilita con `AppTransaction`, riduce ambiguita del payload e rimuove wildcard.

### `src/app/(app)/reports/page.tsx`

Prima:

- query YoY con `transactions.select('*')`;
- query periodo con `transactions.select('*')`.

Dopo:

- select esplicita delle colonne note della transazione.

Motivo: report usa `AppTransaction`, export e categorie; servono i campi transazione principali ma non wildcard.

### `src/app/(app)/transactions/page.tsx`

Prima:

- lista transazioni `select('*')`;
- peer batch `select('*')`;
- peer singolo `select('*')`.

Dopo:

- select esplicita delle colonne note della transazione.

Motivo: pagina ancora CRUD/lista completa, ma le colonne richieste sono dichiarate.

### `src/app/(app)/budgets/page.tsx`

Prima:

- `budgets.select('*')`;
- `transactions.select('*')`.

Dopo:

- budget: `id,user_id,category_id,amount,month,year,created_at,updated_at`;
- transactions: select esplicita delle colonne note.

Motivo: budget non ha bisogno di wildcard.

### `src/app/(app)/settings/page.tsx`

Prima:

- CSV export transazioni selettivo ma incompleto;
- backup transazioni con `select('*')`.

Dopo:

- CSV export usa select esplicita completa per transazioni;
- backup transazioni usa select esplicita completa per transazioni.

Motivo: le transazioni sono il dominio critico; meglio dichiarare ogni campo noto.

## Query lasciate invariate

### Backup JSON non transazionale in settings

Restano:

- `accounts.select('*')`;
- `categories.select('*')`;
- `budgets.select('*')`;
- `recurring_rules.select('*')`;
- `loans.select('*')`;
- `loan_payments.select('*')`;
- `birthdays.select('*')`.

Motivo: il backup completo ha come scopo esportare tutti i campi disponibili per ripristino/migrazione. Ridurre queste select potrebbe perdere dati futuri o campi non ancora modellati nell'export.

## Risultato

Tutte le wildcard su `transactions` nelle pagine principali sono state rimosse.

Le wildcard residue sono confinate al backup completo JSON di tabelle non transazionali.
