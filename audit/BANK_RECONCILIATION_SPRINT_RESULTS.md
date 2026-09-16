# Sprint 26 — Riconciliazione bancaria, saldo verificato, movimenti neutri

Branch: `feat/bank-reconciliation` (da `main`, commit di partenza `453d19c`)

## Obiettivo

Aggiungere un livello di controllo (riconciliazione bancaria + saldo verificato)
sopra il motore contabile esistente, introdurre la classificazione "movimento
neutro / partita di giro" per rimborsi di terzi senza inquinare le metriche
economiche personali, integrare tutto con il Data Integrity Center, e coprire
il comportamento con test di regressione — senza sostituire o duplicare
l'attuale sistema di saldo/RPC.

## Decisioni architetturali

- **Riconciliazione come livello di controllo, non seconda fonte di verità.**
  `accounts.balance` resta l'unica fonte di verità del saldo, mutato solo dalle
  RPC atomiche `create/update/delete_transaction_atomic`. La nuova tabella
  `account_reconciliations` registra confronti puntuali (saldo banca vs snapshot
  del saldo Aurora al momento della verifica) e non scrive mai su
  `accounts.balance`.
- **"Movimento neutro" = flag booleano, non un nuovo `transaction.type`.**
  Aggiunto `transactions.is_neutral boolean not null default false`, forzato a
  `false` per i giroconti (constraint DB `transactions_neutral_not_transfer` +
  logica RPC), invece di introdurre un quarto `TransactionType`. Questo evita di
  toccare la logica di saldo nelle RPC e i numerosi switch su `transaction.type`
  sparsi nel codice.
- **Soglia cent-based, senza banda di tolleranza.** `calculateReconciliationDifference`
  arrotonda al centesimo per essere floating-point-safe, ma `isReconciliationBalanced`
  richiede una differenza arrotondata **esattamente 0.00**: anche +/-0.01 è mismatch.
  La stessa funzione è riusata sia per lo stato riconciliato/mismatch sia per la
  regola Data Integrity `ACCOUNT_RECONCILIATION_MISMATCH` (che non usa più la
  generica `DATA_INTEGRITY_CENT_TOLERANCE` per questa decisione).
- **Storico riconciliazioni, "corrente" derivata da `statement_date DESC, created_at
  DESC`, mai dal solo ordine di inserimento.** Il trigger `supersede_previous_reconciliations`
  confronta le tuple `(statement_date, created_at)`: una riga inserita
  retroattivamente (statement_date più vecchia di una già presente) nasce già
  `superseded` e non scavalca mai la riconciliazione più recente. Lo stesso
  comparatore (`compareReconciliationRecency`) è condiviso da dominio, servizio
  e Data Integrity, così "ultima riconciliazione valida" resta derivabile con
  una query coerente ovunque, senza aggiungere colonne ridondanti a `accounts`.
- **Utility centrale per l'esclusione dalle metriche.** `isEconomicallyNeutralTransaction()`
  e `shouldIncludeInFinancialMetrics()` in `src/domain/accounting/aggregations.ts`
  sono l'unico punto di verità; `isCountableIncome`/`isCountableExpense` (già usati
  da report, transazioni, financial-health) ora passano da lì. Tutti i punti che
  facevano query dirette su Supabase (budget, dashboard, affordability, financial
  health, report) sono stati aggiornati per selezionare/filtrare anche su `is_neutral`.

## Schema DB (migration `00039_bank_reconciliation_and_neutral_transactions.sql`)

- `transactions.is_neutral boolean not null default false` + indice parziale
  `idx_transactions_user_neutral` + constraint `transactions_neutral_not_transfer`.
- Tabella `account_reconciliations`: `account_id, statement_date, bank_balance,
  app_balance_snapshot, difference` (colonna generata), `status` (`reconciled |
  mismatch | pending | superseded`), `source_type` (`manual | import`),
  `source_reference`, `reconciled_at`, timestamp. RLS (SELECT/INSERT/UPDATE/DELETE
  tutte ownership-only; UPDATE verifica anche che `account_id` appartenga
  all'utente, non solo `user_id`), indici su `user_id` e
  `(account_id, statement_date desc, created_at desc)`, trigger `set_updated_at`
  e trigger di "supersede" basato su `(statement_date, created_at)`.
- `create_transaction_atomic` / `update_transaction_atomic`: firme estese con
  `p_is_neutral` (drop + create, non `create or replace`, perché Postgres
  identifica le funzioni per lista di parametri — vedi commento nella migration).
  Matematica del saldo **invariata**: `is_neutral` non tocca gli `UPDATE
  accounts SET balance = ...`.

## File principali modificati/creati

- **Schema/tipi**: `supabase/migrations/00039_...sql`, `src/types/database.ts`.
- **Dominio**: `src/domain/accounting/reconciliation.ts` (nuovo),
  `src/domain/accounting/aggregations.ts`, `src/domain/accounting/transaction-adapter.ts`.
- **Servizi**: `src/lib/reconciliation/service.ts` (nuovo, CRUD riconciliazioni),
  `src/lib/data-integrity/{types,registry,constants,engine,service}.ts`.
- **Metriche esistenti aggiornate per escludere `is_neutral`**: `src/lib/budgets/service.ts`
  (5 query), `src/lib/dashboard/service.ts`, `src/lib/financial-health/{types,service,budgets}.ts`,
  `src/lib/affordability/{types,baseline}.ts` + 5 route `src/app/api/affordability/**`,
  `src/lib/reports/{types,service}.ts`.
- **UI**: `src/app/(app)/reconciliation/page.tsx` (nuova pagina), `src/app/(app)/accounts/page.tsx`
  (colonna stato riconciliazione + CTA), `src/app/(app)/transactions/page.tsx` (toggle
  "movimento neutro" nel form, badge "Neutro" in lista), `src/app/(app)/import-estratti/page.tsx`
  (checkbox "Neutro" per riga, non dedotto automaticamente).
- **API**: `src/app/api/transactions/route.ts` (schema + RPC `p_is_neutral`).

## Nuove regole Data Integrity

Categoria `reconciliation` (nuova, label "Riconciliazione"):

- `ACCOUNT_RECONCILIATION_MISMATCH` — WARNING (o CRITICAL se |differenza| ≥ 50€):
  l'ultima riconciliazione del conto ha una differenza fuori tolleranza. Evidenza:
  conto, data estratto, differenza. Link a `/reconciliation?account=...`.
- `ACCOUNT_NEVER_RECONCILED` — INFO: conto attivo con movimenti mai riconciliato.
- `ACCOUNT_RECONCILIATION_STALE` — INFO: ultima riconciliazione più vecchia di
  `DATA_INTEGRITY_RECONCILIATION_STALE_DAYS` (30 giorni).

Nessun auto-fix del saldo in nessuna delle tre regole.

## Comportamento dei movimenti neutri

Una transazione con `is_neutral = true`:
- **modifica il saldo del conto** normalmente (stessa logica RPC di sempre);
- **resta visibile** nella lista movimenti (con badge "Neutro") e **tracciata**
  (audit log, storico);
- **può essere riconciliata** con l'estratto conto (il saldo che confronta la
  riconciliazione include i movimenti neutri, essendo il saldo reale del conto);
- **è esclusa** da: entrate/uscite personali, budget, calcolo affordability,
  baseline finanziaria, report che misurano reddito/spesa.
- **non può mai essere anche un transfer**: vincolo a livello DB, verificato da
  `tests/unit/reconciliation/migration-static.test.ts`.

Non implementata alcuna euristica automatica per marcare un movimento come
neutro (né in import, né in automazioni): la marcatura è sempre manuale, come
richiesto ("NON cercare di indovinare da solo").

## Hardening correttivo (review mirata post-sprint)

Una seconda passata di review su questo branch (prima di applicare `00039` o
aprire il merge) ha corretto 5 punti nel lavoro già presente:

1. **Riconciliazione a 1 centesimo era troppo permissiva.** `isReconciliationBalanced`
   usava una tolleranza `|differenza| <= 0.01`, quindi +/-0.01 risultava "riconciliato".
   Corretto: il calcolo resta cent-based e floating-point-safe (arrotondamento
   prima del confronto), ma ora richiede **esattamente 0.00** dopo l'arrotondamento.
   Aggiornati i commenti SQL che citavano `<= 0.01`.
2. **"Ultima riconciliazione" dipendeva da `created_at`, fragile con inserimenti
   retroattivi.** Un estratto conto inserito retroattivamente (statement_date più
   vecchia) diventava "corrente" solo perché inserito per ultimo, e il trigger
   `supersede_previous_reconciliations` marcava `superseded` qualunque riga
   precedente indipendentemente dalla data estratto. Corretto introducendo
   `compareReconciliationRecency` (statement_date DESC, created_at DESC come
   tie-breaker) come unico comparatore, condiviso da `latestReconciliationByAccount`,
   dalle query di `src/lib/reconciliation/service.ts`, dallo scan Data Integrity e
   dal trigger SQL (che ora confronta le tuple `(statement_date, created_at)` invece
   di marcare tutto per ordine di inserimento). La UI di `/reconciliation` non fa
   più un aggiornamento ottimistico locale dopo il salvataggio: ri-legge lo storico
   dal server, l'unico che conosce lo stato corretto dopo l'insert.
3. **Evidence Data Integrity errata.** `ACCOUNT_RECONCILIATION_MISMATCH` mostrava
   una voce "Saldo banca" valorizzata con `statement_date` (una data spacciata per
   importo). Corretto: l'evidence ora include conto, saldo banca (`money`), saldo
   Aurora snapshot (`money`), differenza (`money`) e data estratto (`date`).
4. **RLS UPDATE non verificava l'ownership di `account_id`.** La policy UPDATE
   controllava solo `user_id`, permettendo in teoria di ricollegare una propria
   riga a un conto di un altro utente. Aggiunta la stessa verifica `exists (...)`
   già presente su INSERT.
5. **Verifica retrocompatibilità RPC.** Cercate in tutto il repo (route API,
   automazioni, restore, import, integration test) le chiamate a
   `create_transaction_atomic`/`update_transaction_atomic`: tutte usano parametri
   nominati via `supabase.rpc(name, {...})` e nessuna passa `p_is_neutral` in modo
   incompatibile — ometterlo usa semplicemente il default (`false` in create,
   "invariato" in update). Nessuna modifica di codice necessaria; verificato in
   `src/app/api/aurora/route.ts`, `src/lib/automation/service.ts`,
   `tests/integration/supabase-accounting.integration.test.ts`.

Migration `00039` **modificata in place** (non con una `00040` successiva):
non è mai stata applicata a nessun ambiente Supabase, quindi la correzione
diretta è appropriata per un lavoro locale non ancora mergiato.

## Test aggiunti (FASE 11 — tutti i 12 casi obbligatori)

| # | Caso | File |
|---|------|------|
| 1 | Riconciliazione perfetta (0 differenza) | `src/domain/accounting/reconciliation.test.ts` |
| 2 | Mismatch -6.10 | `src/domain/accounting/reconciliation.test.ts` |
| 3 | Spesa neutra non aumenta le spese | `src/domain/accounting/neutral-transactions.test.ts` |
| 4 | Entrata neutra non aumenta le entrate | `src/domain/accounting/neutral-transactions.test.ts` |
| 5 | Transfer non diventa neutro per errore (vincolo DB + comportamento runtime) | `neutral-transactions.test.ts`, `tests/unit/reconciliation/migration-static.test.ts` |
| 6 | Scenario realistico combinato (metriche, saldo, riconciliazione coerenti) | `src/domain/accounting/neutral-transactions.test.ts` |
| 7 | Data Integrity: mismatch crea issue | `tests/unit/data-integrity/engine.test.ts` |
| 8 | Data Integrity: reconciled → nessuna issue di mismatch | `tests/unit/data-integrity/engine.test.ts` |
| 9 | Report esclude i neutri | `tests/unit/reports/calculations.test.ts` |
| 10 | Budget esclude i neutri (verifica query `.eq('is_neutral', false)`) | `tests/unit/budgets/neutral-exclusion.test.ts` |
| 11 | Affordability esclude i neutri | `tests/unit/affordability/baseline.test.ts` |
| 12 | Multi-scope: neutro PERSONAL non altera DEPENDENT_AURORA/ADI | `tests/unit/dependent-finance/neutral-scope-independence.test.ts` |

Più: test aggiuntivi su `ACCOUNT_NEVER_RECONCILED`/`ACCOUNT_RECONCILIATION_STALE`,
sui parametri `p_is_neutral` nell'API `/api/transactions` (`tests/api/transactions-route.test.ts`),
e adeguamento di ~10 fixture di test preesistenti al nuovo campo obbligatorio
`Transaction.is_neutral`.

## Risultati verifiche (FASE 12)

- `npx tsc --noEmit` → **0 errori**.
- `npx vitest run` → **145 file di test passati, 1865 test passati, 14 skip, 0 falliti**
  (un run intermedio ha mostrato 4 fallimenti da timeout del worker pool di Vitest,
  non riproducibili isolando i file: rieseguiti singolarmente passano in 1.6s;
  causa: contesa di risorse della macchina locale, non un difetto del codice).
- `npm run test:coverage` → **Statements 85.61% · Branches 77.98% · Functions 88.4% · Lines 87.84%**,
  nessuna soglia di coverage violata (exit code 0); i moduli toccati da questo
  sprint (`domain/accounting`, `lib/data-integrity`, `lib/reports`) sono coperti
  al 94–100% sulle statement.
- `npm run build` → compilazione Next.js/Turbopack e type-check **completati con
  successo** ("Compiled successfully", "Finished TypeScript"); la fase di
  *page data collection* fallisce su `/api/notifications/daily-check` perché
  questa macchina locale non ha `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`
  configurate (solo `.env.example` presente, nessun `.env.local`). Non è una
  regressione di questo sprint: quella route non è stata toccata e l'errore è
  identico per qualunque build locale senza credenziali Supabase reali.
- `git diff --check` → nessun errore di whitespace.
- `npm run lint` → **non eseguibile in questo repo**: `next lint` non è supportato
  da Next.js 16.2.12 (rimosso upstream) e non è presente alcuna configurazione
  ESLint locale (`eslint.config.*`/`.eslintrc*` assenti, nessuna dipendenza
  `eslint` installata). Limite preesistente del progetto, non introdotto da
  questo sprint.

## Limiti residui

- **FASE 8 (polish Budget/Scenari/Notifiche)** non affrontata in questo sprint:
  priorità data alla correttezza contabile (riconciliazione, neutri, Data
  Integrity, test) esplicitamente definita come obbligatoria. Nessuna modifica
  di logica finanziaria era comunque prevista in quella fase.
- **`financial-health/data-quality.ts`**: il conteggio "movimenti sufficienti per
  un punteggio affidabile" non esclude i movimenti neutri (non richiesto dai 12
  casi obbligatori; è una metrica di copertura dati, non economica).
- **Import estratti**: la marcatura "neutro" per riga è manuale e non persiste
  suggerimenti tra import successivi; nessuna euristica automatica introdotta,
  come richiesto.
- **UI riconciliazione**: mostra un unico storico per conto selezionato; non
  implementata una vista aggregata multi-conto (non richiesta esplicitamente).
- **`next lint`** non eseguibile per limite di versione/configurazione preesistente
  del progetto (vedi sopra) — non verificabile con gli strumenti disponibili in
  questa sessione.

## Istruzioni per applicare la migration in produzione

**Non è stata eseguita alcuna migration su Supabase in questa sessione.**

1. Verificare che l'ultima migration applicata in produzione sia `00038_backfill_shared_aurora_personal_scope.sql`.
2. Rivedere `supabase/migrations/00039_bank_reconciliation_and_neutral_transactions.sql`
   (idempotente: `add column if not exists`, `create table if not exists`,
   `drop function if exists` + `create or replace`, `drop trigger/policy if exists`
   prima di ricrearli — sicura da rieseguire).
3. Applicare con la CLI Supabase dal branch `feat/bank-reconciliation`:
   ```
   supabase db push
   ```
   oppure, se il flusso del progetto usa migration remote dirette:
   ```
   supabase migration up --linked
   ```
4. Verificare dopo il deploy:
   - `select * from public.account_reconciliations limit 1;` (tabella esiste, RLS attiva)
   - `select is_neutral from public.transactions limit 1;` (colonna esiste, default false)
   - Creare una transazione di test da UI/staging e controllare che il saldo
     conto si aggiorni come prima (nessuna regressione sulle RPC esistenti).
5. Nessun backfill dati necessario: `is_neutral` ha default `false` per tutte le
   righe esistenti, `account_reconciliations` parte vuota.

## Istruzioni per test manuale in locale

1. `npm run dev`, effettuare login.
2. **Movimento neutro**: da "Movimenti" → "Nuovo movimento", creare una spesa o
   entrata, attivare "Movimento neutro / partita di giro", salvare. Verificare:
   badge "Neutro" in lista, saldo conto aggiornato, movimento assente da
   dashboard/budget/report come spesa/entrata.
3. **Riconciliazione**: da "Conti", cliccare "Riconcilia" su un conto → inserire
   saldo banca e data estratto. Con saldo uguale a quello Aurora: badge
   "Riconciliato". Con differenza: badge con importo e suggerimenti generici.
   Verificare storico riconciliazioni sotto al form.
4. **Data Integrity**: dalla pagina "Data Integrity", eseguire una scansione dopo
   aver registrato una riconciliazione con differenza: deve comparire
   `ACCOUNT_RECONCILIATION_MISMATCH`. Su un conto mai riconciliato con
   movimenti: `ACCOUNT_NEVER_RECONCILED`.
5. **Import estratti**: importare un CSV, marcare una riga come "Neutro" prima di
   confermare l'importazione, verificare che il movimento importato risulti
   neutro nella lista movimenti.

## Merge

**Non consigliato il merge automatico su `main` da questa sessione.** Il codice
è verificato (tsc, test, coverage, build applicativo) ma manca:
- revisione umana della UI (nessun test end-to-end/browser eseguito in questa sessione);
- applicazione e verifica della migration su un ambiente Supabase reale (staging);
- decisione del team sulla soglia CRITICAL (50€) per `ACCOUNT_RECONCILIATION_MISMATCH`
  e sulla soglia di 30 giorni per "stale", entrambe scelte ragionevoli ma arbitrarie.

Consigliato: aprire una PR da `feat/bank-reconciliation` verso `main`, far girare
la migration su staging, validare manualmente i punti sopra, poi procedere al merge.
