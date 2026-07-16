# Sprint 1 - Risultati test automatici

## Esito sintetico

Sprint 1 completato con successo.

Sono stati introdotti test automatici isolati per il comportamento contabile e per la route API delle transazioni, senza usare dati reali Supabase e senza modificare schema, migration, RPC o logica applicativa esistente.

## Framework

Framework introdotto: Vitest.

Coverage provider: V8 tramite `@vitest/coverage-v8`.

Ambiente test: Node.

## File creati

- `audit/SPRINT_1_TEST_PLAN.md`
- `audit/SPRINT_1_TEST_RESULTS.md`
- `vitest.config.ts`
- `src/domain/accounting/calculations.ts`
- `src/domain/accounting/calculations.test.ts`
- `tests/fixtures/accounting-fixture.ts`
- `tests/api/transactions-route.test.ts`

## File modificati

- `package.json`
- `package-lock.json`

## Script aggiunti

- `npm run test`
- `npm run test:run`
- `npm run test:watch`
- `npm run test:coverage`

## Test implementati

Totale test: 24.

Suite:

- `src/domain/accounting/calculations.test.ts`: 7 test.
- `tests/api/transactions-route.test.ts`: 17 test.

## Copertura funzionale

### Calcoli contabili

Coperti:

- Arrotondamento valuta a due decimali.
- Range mese, inclusi febbraio bisestile e confini anno.
- Totali mensili income/expense/net.
- Esclusione dei movimenti con `transfer_peer_id` dai totali mensili, coerente con il comportamento corrente di dashboard/report.
- Applicazione di entrate.
- Applicazione di uscite.
- Applicazione di giroconti su conto origine e destinazione.
- Fixture multi-mese con transazioni duplicate.
- Aggregazione spese da sottocategoria a categoria padre.
- Separazione delle transazioni senza categoria.

### API transazioni

Coperti:

- `POST /api/transactions`
  - Utente non autenticato.
  - `account_id` mancante.
  - Tipo transazione non valido.
  - Importo zero.
  - Importo negativo.
  - Giroconto senza destinazione omessa, delegato alla RPC.
  - Creazione income.
  - Creazione expense.
  - Creazione transfer.
  - Errore RPC di ownership.
- `PATCH /api/transactions`
  - `transaction_id` mancante.
  - Importo non valido.
  - Errore RPC di ownership.
  - Update valido tramite RPC atomica.
- `DELETE /api/transactions`
  - `transaction_id` mancante.
  - Errore RPC not found.
  - Delete valido tramite RPC atomica.

## Comandi eseguiti

### Installazione dipendenze

Comando:

```bash
npm install -D vitest @vitest/coverage-v8
```

Esito: completato.

Nota: `npm install` ha segnalato 3 vulnerabilita' nel dependency tree, 2 moderate e 1 high. Non e' stato eseguito `npm audit fix` perche' avrebbe introdotto modifiche non richieste dallo sprint.

### Test

Comando:

```bash
npm run test:run
```

Esito: superato.

Risultato:

- Test files: 2 passed.
- Tests: 24 passed.

### Coverage

Comando:

```bash
npm run test:coverage
```

Esito: superato.

Coverage sul modulo contabile isolato:

- Statements: 100%.
- Branches: 93.54%.
- Functions: 100%.
- Lines: 100%.

### Build

Comando:

```bash
npm run build
```

Esito: superato.

Risultato:

- Next.js compiled successfully.
- TypeScript completato senza errori.
- Static pages generate: 19/19.

## Comportamenti sospetti osservati

Questi comportamenti sono stati documentati dai test o dall'analisi, ma non corretti in Sprint 1 per rispettare il vincolo di non modificare la logica applicativa.

### 1. `POST /api/transactions` e `destination_account_id`

Nel create schema, `destination_account_id` e' opzionale ma non nullable.

Effetto:

- Se il client invia `destination_account_id: null`, la request viene respinta con 400.
- Se il client omette `destination_account_id` per un transfer, la request passa Zod e la RPC riceve `p_destination_account_id: null`.

Questo comportamento e' tecnicamente incoerente e andrebbe normalizzato in uno sprint successivo.

### 2. Risposte API non sempre semantiche

La route transazioni risponde:

- `POST`: `{ data }`
- `PATCH`: `{ data }`
- `DELETE`: `{ success: true }`

La forma e' valida, ma non uniforme. Per una API stabile sarebbe preferibile un contratto coerente.

### 3. `DELETE /api/transactions` usa body JSON

La delete route richiede `{ transaction_id }` nel body. Se chiamata senza body JSON valido, puo' cadere nel catch generico con 500.

Questo e' un dettaglio da rendere piu' robusto in futuro, specialmente per client e debugging.

### 4. `transfer_peer_id` semanticamente ambiguo

Dalle migration risulta che `transfer_peer_id` ha avuto significati diversi nel tempo:

- riferimento a transazione collegata;
- riferimento a conto destinazione;
- UUID libero dopo rimozione del vincolo FK.

Questo e' uno dei punti piu' importanti da stabilizzare prima di estendere report, budget e riconciliazioni.

### 5. I test API validano il contratto, non gli effetti reali database

Le route delegano gli effetti contabili alle RPC Supabase. I test mockano Supabase e validano:

- autenticazione;
- validazione payload;
- mapping errori;
- nome RPC invocata;
- parametri passati.

Non validano l'effetto reale su saldi e transazioni nel database. Per quello servira' una fase successiva con test di integrazione su database locale/ephemeral.

## Conferme sui vincoli

- Nessun dato Supabase reale modificato.
- Nessuna query eseguita verso Supabase reale.
- Nessuna migration modificata.
- Nessuna migration creata.
- Nessuna RPC modificata.
- Nessuno schema database modificato.
- Nessuna pagina UI modificata.
- Nessun commit eseguito.
- Nessun push eseguito.

## Prontezza per Sprint 2

Il progetto ora ha una prima rete di sicurezza automatizzata.

Pronto per Sprint 2 con una raccomandazione: prima di modificare logica contabile reale, chiarire e normalizzare in modo definitivo il modello dei giroconti, in particolare il significato di `transfer_peer_id` e il contratto tra UI, API e RPC.
