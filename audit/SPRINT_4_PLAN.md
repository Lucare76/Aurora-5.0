# Sprint 4 - Piano

## Obiettivo

Ridurre il debito tecnico residuo su query, export e letture dirette di `transfer_peer_id`, mantenendo invariati dati, schema, RPC, migration e risultati contabili.

## Query `select('*')` trovate

- `src/hooks/use-transactions.ts`: query generica transazioni.
- `src/app/(app)/dashboard/page.tsx`: chart ultimi 6 mesi.
- `src/app/(app)/reports/page.tsx`: report periodo e YoY.
- `src/app/(app)/transactions/page.tsx`: lista transazioni, peer batch, peer singolo.
- `src/app/(app)/budgets/page.tsx`: budget e transazioni mese.
- `src/app/(app)/settings/page.tsx`: backup JSON.

## Query da ottimizzare in Sprint 4

- Hook transazioni: select esplicita di tutte le colonne necessarie ad `Transaction` e `AppTransaction`.
- Dashboard chart: select esplicita transazioni minime per adapter.
- Reports: select esplicita periodo e YoY.
- Budgets: select esplicita budget e transazioni minime.
- Transactions: select esplicita per lista e peer.
- Settings export CSV: gia' selettivo, ma va migrato a `AppTransaction`.

## Query lasciate con forma ampia

- Backup JSON completo in settings puo' mantenere `select('*')` per tabelle non contabili, perche' lo scopo e' esportare tutti i campi disponibili.
- La tabella `transactions` nel backup verra' resa esplicita per includere tutti i campi noti, evitando perdita dati e riducendo ambiguita.

## Export da migrare

Settings CSV attuale:

- seleziona `transfer_peer_id`;
- filtra tutti i record con `transfer_peer_id`;
- quindi perde transfer storici e nuovi.

Nuovo export:

- converte DB rows in `AppTransaction`;
- esporta income, expense, transfer storico e transfer nuovo;
- non perde movimenti;
- espone tipo leggibile in italiano;
- gestisce categorie null;
- preserva data, descrizione, importo, conto sorgente, conto destinazione e classificazione transfer.

## Letture dirette `transfer_peer_id`

Da eliminare dove sicuro:

- settings CSV export.

Da confinare/documentare:

- adapter e transfer model;
- query legacy in transactions per recuperare peer;
- dashboard ultimi movimenti e budget alert;
- report YoY lato DB;
- tipi DB e migration.

## Test da aggiungere

- Export income.
- Export expense.
- Export transfer storico.
- Export transfer nuovo.
- Export movimento senza categoria.
- Export stesso importo/data con descrizioni diverse.
- Export completo senza perdita righe.
- Round-trip logico campi CSV.
- Mapping query result verso adapter.
- Parita' numerica dopo select esplicite.

## Rischi

- Export: rischio medio, perche' cambia da "movimenti contabili senza transfer" a "movimenti completi". Richiesto dallo Sprint 4.
- Query esplicite: rischio basso/medio, mitigato mantenendo tutte le colonne richieste dai tipi.
- Transactions page: rischio medio; non cambia UI, solo lista colonne.
- Backup: rischio basso, se la select esplicita include tutti i campi noti.

## Criteri di accettazione

- Almeno 90 test.
- Coverage non inferiore allo Sprint 3.
- Build verde.
- Meno `select('*')` nel codice app principale.
- Nessuna modifica a DB, dati, migration o RPC.
- Nessun commit/push.
