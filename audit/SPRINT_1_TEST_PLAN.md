# Sprint 1 - Test automatici e stabilizzazione

## Obiettivo

Introdurre una base di test automatizzati per Aurora 5.0 senza modificare dati reali, schema Supabase, migration, RPC, logica contabile applicativa, dashboard, report o interfaccia utente.

Lo sprint ha finalita' diagnostica e protettiva: creare test ripetibili che documentino il comportamento attuale e permettano di intercettare regressioni prima degli sprint successivi.

## Vincoli operativi

- Nessuna modifica al database reale.
- Nessuna migration.
- Nessuna modifica alle RPC Supabase.
- Nessuna correzione della logica contabile esistente.
- Nessuna modifica ai flussi UI.
- Nessun commit.
- Nessun push.
- I test useranno fixture locali e mock, non dati Supabase reali.

## Framework scelto

Framework: Vitest.

Motivazioni:

- Integrabile rapidamente in un progetto TypeScript/Next.js.
- Esegue test unitari e test di route handler in ambiente Node.
- Supporta mock espliciti per Supabase.
- Supporta coverage tramite V8.
- Richiede configurazione contenuta e non impatta il runtime applicativo.

## File analizzati

- `package.json`
- `src/app/api/transactions/route.ts`
- `src/hooks/use-transactions.ts`
- `src/types/database.ts`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/reports/page.tsx`
- `supabase/migrations/00001_initial_schema.sql`
- `supabase/migrations/00002_financial_atomic_functions.sql`
- `supabase/migrations/00003_fix_atomic_functions.sql`
- `supabase/migrations/00009_fix_transfer_peer_id_fkey.sql`

## Aree da coprire

### Calcoli contabili puri

Testare con fixture locali:

- Entrata.
- Uscita.
- Giroconto.
- Saldo mensile.
- Saldo netto.
- Decimali.
- Date di inizio/fine mese.
- Esclusione dei movimenti collegati da report mensili secondo il comportamento attuale.
- Aggregazione per categoria padre/sottocategoria.
- Transazioni duplicate stesso giorno/importo.

### API transazioni

Testare `POST`, `PATCH`, `DELETE` con Supabase mockato:

- Utente non autenticato.
- Payload non valido.
- Importo zero.
- Importo negativo.
- Tipo transazione non valido.
- Giroconto senza conto destinazione.
- Successo RPC.
- Errore RPC.
- Accesso negato / risorsa non appartenente all'utente.

### Fixture

Creare una fixture deterministica con:

- 2 conti.
- Categorie income/expense.
- Categoria padre e sottocategoria.
- 10+ transazioni distribuite su almeno 2 mesi.
- Giroconti.
- Decimali.
- Transazioni con `transfer_peer_id`.
- Transazioni duplicate.

## File previsti

### Nuovi file

- `vitest.config.ts`
- `src/domain/accounting/calculations.ts`
- `src/domain/accounting/calculations.test.ts`
- `tests/fixtures/accounting-fixture.ts`
- `tests/api/transactions-route.test.ts`
- `audit/SPRINT_1_TEST_RESULTS.md`

### File modificati

- `package.json`
- `package-lock.json`

## Script previsti

- `npm run test`
- `npm run test:run`
- `npm run test:watch`
- `npm run test:coverage`

## Criteri di successo

- `npm run test:run` deve passare.
- `npm run test:coverage` deve produrre un report coverage.
- `npm run build` deve completare con successo.
- Nessuna chiamata a Supabase reale.
- Nessuna modifica a migration, RPC, schema o dati.
- Nessun commit e nessun push.

## Rischi noti da documentare

- Il campo `transfer_peer_id` ha avuto significati diversi nel tempo: riferimento a transazione collegata o riferimento a conto destinazione.
- Le API delegano molta logica contabile alle RPC, quindi i test API possono validare contratto e gestione errori, ma non l'effetto reale su saldo database.
- Alcuni comportamenti potenzialmente discutibili saranno documentati come comportamento attuale, non corretti in questo sprint.
