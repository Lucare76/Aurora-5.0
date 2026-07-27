# Sprint 15 - Data Integrity Center

## Architettura

Sprint 15 introduce un Data Integrity Center deterministico composto da:

- registry regole e whitelist azioni in `src/lib/data-integrity/registry.ts`;
- fingerprint stabile in `src/lib/data-integrity/fingerprint.ts`;
- motore puro senza effetti collaterali in `src/lib/data-integrity/engine.ts`;
- servizio Supabase per fetch, scansione e persistenza in `src/lib/data-integrity/service.ts`;
- API in `src/app/api/data-integrity/*`;
- pagina utente in `src/app/(app)/data-integrity/page.tsx`;
- widget dashboard in `src/components/dashboard/dashboard-widgets.tsx`;
- migration locale `supabase/migrations/00024_data_integrity_center.sql`.

La scansione produce issue. Non modifica conti, saldi, movimenti, budget, prestiti, obiettivi o Financial Health.

## Fonti di verità

- Saldi reali: `accounts.balance`, aggiornato dalle RPC atomiche esistenti.
- Movimenti: `transactions`, create/update/delete tramite RPC atomiche.
- Giroconti: modello corrente single-row `type = transfer` con `transfer_peer_id` verso conto destinazione; controlli legacy supportano anche peer verso transazione.
- Categorie: `categories`, gerarchia via `parent_id`.
- Ricorrenze: `recurring_rules`, istanze via `transactions.recurring_id`.
- Budget: `budgets` per categoria/mese/anno.
- Obiettivi: `savings_goals` e `goal_contributions`; `current_amount` resta governato dai trigger già presenti.
- Prestiti: `loans` e `loan_payments`.
- Notifiche: `notifications`, `dedupe_key`, `source_type`, `source_id`.
- Financial Health: `financial_health_snapshots` e motore Sprint 14A.
- Backup: export opzionale di stati issue, non di cache pesante.

## Tabelle analizzate

- `accounts`
- `transactions`
- `categories`
- `recurring_rules`
- `budgets`
- `savings_goals`
- `goal_contributions`
- `loans`
- `loan_payments`
- `notifications`
- `financial_health_snapshots`
- `dashboard_preferences`
- `backup_restore_runs`
- `backup_restore_tokens`

## Migration

Creata localmente:

- `supabase/migrations/00024_data_integrity_center.sql`

Tabelle:

- `data_integrity_scan_runs`
- `data_integrity_issues`

Indici:

- `data_integrity_scan_runs_user_started`
- `data_integrity_issues_user_status_severity`
- `data_integrity_issues_rule`

Constraint:

- mode scan: `quick`, `full`, `targeted`
- status scan: `running`, `completed`, `failed`
- status issue: `open`, `acknowledged`, `ignored`, `resolved`, `stale`
- severity issue: `CRITICAL`, `WARNING`, `INFO`
- confidence issue: `high`, `medium`, `low`
- unique `(user_id, fingerprint)`

RLS:

- select/insert/update solo per `(select auth.uid()) = user_id`.

La migration non e stata applicata in remoto.

## Ruleset

Versione ruleset: `2026.07.15`.

Regole implementate: 45.

Categorie:

- Transazioni
- Giroconti
- Saldi
- Ricorrenze
- Prestiti
- Budget
- Obiettivi
- Categorie
- Riferimenti orfani
- Financial Health
- Notifiche
- Coerenza temporale

Regole principali:

- `TRANSACTION_EXACT_DUPLICATE`
- `TRANSACTION_POSSIBLE_DUPLICATE`
- `TRANSACTION_MISSING_CATEGORY`
- `TRANSFER_MISSING_COUNTERPART`
- `TRANSFER_SAME_ACCOUNT`
- `TRANSFER_LEGACY_PEER_ORPHAN`
- `TRANSFER_LEGACY_PEER_INCOHERENT`
- `TRANSFER_LEGACY_AMOUNT_MISMATCH`
- `ACCOUNT_BALANCE_NON_FINITE`
- `RECURRING_DUPLICATE_INSTANCE`
- `LOAN_DUPLICATE_PAYMENT`
- `BUDGET_ORPHAN_CATEGORY`
- `GOAL_CONTRIBUTIONS_MISMATCH`
- `CATEGORY_DUPLICATE_NAME`
- `FINANCIAL_HEALTH_SNAPSHOT_OUTDATED`
- `NOTIFICATION_SOURCE_ORPHAN`

## Fingerprint

Il fingerprint e deterministico e usa:

- `user_id`;
- `rule_code`;
- `entity_type`;
- `entity_ids` normalizzati, deduplicati e ordinati.

Questo evita duplicazioni tra scansioni successive.

## Lifecycle issue

Stati:

- `open`
- `acknowledged`
- `ignored`
- `resolved`
- `stale`

Nuove scansioni:

- creano nuove issue;
- aggiornano `last_detected_at`;
- mantengono `ignored` e `acknowledged` per fingerprint identico;
- riaprono `resolved` se il fingerprint ricompare;
- marcano `resolved` issue open/acknowledged non più rilevate.

## API

- `GET /api/data-integrity`
- `POST /api/data-integrity/scan`
- `GET /api/data-integrity/issues/[id]`
- `POST /api/data-integrity/issues/[id]/status`

Le API richiedono autenticazione e usano solo dati dell'utente.

## UI

Pagina:

- `/data-integrity`

Funzioni:

- riepilogo critical/warning/info;
- ultima scansione;
- filtri per stato, gravità e categoria;
- lista responsive issue;
- dettaglio evidence leggibile;
- azioni: riconosci, ignora, riapri, segna risolta;
- scansione manuale con conferma;
- aria-live per stato scansione.

## Dashboard

Aggiunto widget:

- `data-integrity`

Mostra:

- critical aperte;
- warning aperte;
- ultima scansione;
- stato integrità;
- massimo tre issue prioritarie;
- CTA verso `/data-integrity`.

## Command menu e navigazione

Aggiunti:

- Apri integrità dati
- Avvia scansione rapida
- Problemi critici
- Transazioni duplicate
- Giroconti incompleti

Aggiunta voce sidebar/mobile:

- Integrità dati

## Backup & Restore

Backup export:

- esporta opzionalmente `dataIntegrityIssues` solo per stati `ignored` e `acknowledged`.

Restore:

- non ripristina issue attive obsolete;
- aggiorna solo stati su fingerprint già esistenti;
- restore non fatale;
- consigliata nuova scansione dopo restore.

## Sicurezza

- Nessun service role nel browser.
- Nessuna query dinamica da payload client.
- Stato issue aggiornabile solo su record dell'utente.
- Azioni whitelisted dal registry.
- Nessuna correzione finanziaria automatica.
- Nessuna eliminazione automatica.
- Nessuna API esterna.
- Nessun cron.
- Nessuna AI.

## Performance

- Fetch dati in batch.
- Regole in memoria su mappe e gruppi.
- Nessuna query per singola issue.
- Limite issue per scansione: 2.000.
- Limite transazioni fetch: 100.000.

## Limiti residui

- La riconciliazione saldo non ricalcola il saldo storico perché lo schema non contiene `initial_balance`.
- Le fix preview/apply sono predisposte come azioni ma non implementano correzioni automatiche in questo sprint.
- Financial Health non viene penalizzato dalle issue Data Integrity per evitare doppio conteggio.
- Notifiche Data Integrity non vengono create automaticamente in questo sprint.
- Test manuali responsive non eseguiti in browser.
- Le modalita `full` e `targeted` sono accettate dal contratto API/persistenza; in questa versione usano lo stesso motore deterministico e lo stesso dataset della scansione rapida.
- Non sono state implementate correzioni applicabili: il centro genera diagnostica, evidenze e link verso i flussi esistenti.

## Test

Aggiunti:

- `tests/unit/data-integrity/engine.test.ts`

Copre:

- fingerprint stabile;
- registry;
- duplicati;
- giroconti validi/anomali;
- riferimenti orfani;
- importi invalidi;
- ricorrenze;
- budget;
- prestiti;
- obiettivi;
- categorie;
- snapshot Financial Health;
- notifiche;
- riepilogo e ordinamento.

## Verifiche

Eseguite il 2026-07-27:

- `npx tsc --noEmit`: passato.
- `npx vitest run`: passato, 43 file passati, 1 skipped, 636 test passati, 14 skipped, 0 failed.
- `npm run test:coverage`: passato, 43 file passati, 1 skipped, 636 test passati, 14 skipped, 0 failed.
- Coverage globale: statement 93.78%, branch 84.19%, funzioni 97.91%, linee 96.14%.
- Coverage `src/lib/data-integrity`: statement 95.95%, branch 90.43%, funzioni 98.83%, linee 99.43%.
- `npm run build`: passato, build Next.js production compilata correttamente.
- `git diff --check`: passato. Sono presenti solo warning CRLF/LF di Windows, nessun errore whitespace.

## File creati

- `audit/DATA_INTEGRITY_SPRINT_15_RESULTS.md`
- `src/app/(app)/data-integrity/page.tsx`
- `src/app/api/data-integrity/route.ts`
- `src/app/api/data-integrity/scan/route.ts`
- `src/app/api/data-integrity/issues/[id]/route.ts`
- `src/app/api/data-integrity/issues/[id]/status/route.ts`
- `src/lib/data-integrity/constants.ts`
- `src/lib/data-integrity/engine.ts`
- `src/lib/data-integrity/fingerprint.ts`
- `src/lib/data-integrity/registry.ts`
- `src/lib/data-integrity/service.ts`
- `src/lib/data-integrity/types.ts`
- `supabase/migrations/00024_data_integrity_center.sql`
- `tests/unit/data-integrity/engine.test.ts`

## File modificati

- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/layout.tsx`
- `src/app/api/backup/restore/route.ts`
- `src/components/dashboard/dashboard-widgets.tsx`
- `src/components/global-command-menu.tsx`
- `src/lib/backup/export/fetch-user-backup-data.ts`
- `src/lib/backup/export/map-backup-data.ts`
- `src/lib/backup/schema.ts`
- `src/lib/backup/types.ts`
- `src/lib/dashboard/types.ts`
- `src/lib/dashboard/widget-registry.ts`
- `src/lib/supabase/admin.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/types/database.ts`
- `supabase/migrations/00023_dashboard_preferences.sql`
- `tests/api/backup-export-route.test.ts`
- `tests/integration/supabase-accounting.integration.test.ts`
- `vitest.config.ts`

## Note di verifica

- Le modifiche ai client Supabase sono di tipizzazione e compatibilita TypeScript del progetto, non introducono service role nel browser.
- Il test backup export e stato aggiornato per supportare il nuovo filtro Supabase `.in()` sugli stati Data Integrity esportabili.
- La migration `00024_data_integrity_center.sql` e stata creata localmente ma non applicata a Supabase remoto.
- Nessuna correzione automatica modifica dati finanziari.

## Conferme

- Nessun commit.
- Nessun push.
- Nessuna migration remota applicata.
- Nessun dato finanziario modificato automaticamente.
