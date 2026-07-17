# Backup Sprint 3 - Results

## Sintesi

Implementato export completo Aurora Backup v1 per l'utente autenticato.

Il flusso:

1. usa una route server autenticata;
2. legge dati tramite Supabase session client, senza service role;
3. rispetta RLS;
4. mappa i record database nel formato Aurora Backup v1;
5. calcola record counts con il modulo Backup Sprint 2;
6. calcola checksum SHA-256 canonico con il modulo Backup Sprint 2;
7. valida il backup con `inspectAuroraBackup`;
8. blocca il download se il backup generato ha errori;
9. restituisce JSON UTF-8 come attachment con `Cache-Control: no-store`.

Nessun restore, upload, merge, dry-run restore o scrittura database e' stato
introdotto.

## File creati

- `src/lib/backup/export/fetch-user-backup-data.ts`
- `src/lib/backup/export/map-backup-data.ts`
- `src/lib/backup/export/generate-aurora-backup.ts`
- `src/lib/backup/export/filename.ts`
- `src/lib/backup/export/index.ts`
- `src/app/api/backup/export/route.ts`
- `tests/unit/backup/backup-export.test.ts`
- `tests/api/backup-export-route.test.ts`
- `audit/BACKUP_SPRINT_3_PLAN.md`
- `audit/BACKUP_SPRINT_3_RESULTS.md`

## File modificati

- `src/lib/backup/index.ts`
- `src/app/(app)/settings/page.tsx`

## Entita incluse

| Entita Backup v1 | Tabella origine | Note |
| --- | --- | --- |
| `profile` | `profiles` | Riga dell'utente autenticato, `id = auth.user.id`. |
| `accounts` | `accounts` | Conti dell'utente autenticato. |
| `categories` | `categories` | Categorie e sottocategorie. |
| `transactions` | `transactions` | Movimenti, inclusi riferimenti transfer/recurring. |
| `budgets` | `budgets` | Budget mensili. |
| `recurringRules` | `recurring_rules` | Regole ricorrenti. |
| `loans` | `loans` | Prestiti dati/ricevuti. |
| `loanPayments` | `loan_payments` | Pagamenti prestiti. |
| `birthdays` | `birthdays` | Compleanni e reminder days. |
| `birthdayReminderLog` | `birthday_reminder_log` | Visibile solo se RLS consente lettura. |
| `auditLogs` | `audit_logs` | Audit log dell'utente. |

## Entita escluse

- Auth metadata, password, token, cookie e sessioni.
- Chiavi API e service role key.
- File fisici collegati a `receipt_url`.
- Import metadata non presente nel formato Aurora Backup v1.
- `ip_address` degli audit log, per minimizzare dati personali.

## Origine appVersion

`appVersion` viene letto da `package.json`, campo `version`.

## Autenticazione e RLS

La route `GET /api/backup/export` usa `createClient()` da
`src/lib/supabase/server.ts` e chiama `supabase.auth.getUser()`.

Non accetta `user_id` dal client e non permette di scegliere un altro utente.
Le query filtrano l'utente autenticato e passano comunque attraverso le policy
RLS del client Supabase anon/session.

## Query dati

Le query usano select esplicite, non `select("*")`.

- `profiles`: `id,display_name,avatar_url,currency,locale,timezone,onboarding_done,created_at,updated_at`
- `accounts`: `id,user_id,name,type,color,icon,balance,currency,is_active,is_hidden,sort_order,created_at,updated_at`
- `categories`: `id,user_id,name,type,color,icon,parent_id,is_default,sort_order,created_at`
- `transactions`: `id,user_id,account_id,category_id,type,amount,description,notes,date,transfer_peer_id,recurring_id,receipt_url,receipt_data,created_at,updated_at`
- `budgets`: `id,user_id,category_id,amount,month,year,created_at,updated_at`
- `recurring_rules`: `id,user_id,account_id,category_id,type,amount,description,frequency,start_date,end_date,next_due_date,last_run_date,is_active,auto_create,created_at,updated_at`
- `loans`: `id,user_id,counterpart,type,amount,remaining,description,due_date,is_settled,settled_at,created_at,updated_at`
- `loan_payments`: `id,loan_id,user_id,amount,paid_at,notes,created_at`
- `birthdays`: `id,user_id,name,birth_date,reminder_days,notes,created_at,updated_at`
- `birthday_reminder_log`: `id,birthday_id,user_id,days_before,year,sent_at`
- `audit_logs`: `id,user_id,action,table_name,record_id,old_data,new_data,created_at`

## Mapping

I mapper sono puri e separati dalle query.

- mantengono gli ID originali;
- mantengono relazioni interne;
- preservano importi come numeri;
- preservano date ISO/date-only gia presenti;
- gestiscono `null`;
- non mutano input;
- non esportano `user_id` come ownership affidabile;
- non esportano `ip_address` dagli audit log.

## Record counts

I record counts sono calcolati esclusivamente con
`calculateRecordCounts()` dal modulo Backup Sprint 2.

Tutte le collezioni supportate sono presenti, incluse quelle vuote con count
zero.

## Checksum

Il checksum viene calcolato con `computeBackupChecksum()` dopo aver impostato i
record counts e prima della serializzazione finale.

Il checksum non e' una firma digitale.

## Validazione pre-download

La generazione chiama `inspectAuroraBackup()` sul backup completo.

- issue `error`: blocca il download;
- warning/info: consentiti;
- errori tecnici non vengono esposti all'utente con dettagli sensibili.

## Nome file

`createAuroraBackupFilename(date)` produce:

`aurora-backup-v1-YYYY-MM-DD-HHmmss.json`

Il timestamp e' deterministico rispetto alla data passata e usa UTC.

## API

Creata route:

- `GET /api/backup/export`

Header:

- `Content-Type: application/json; charset=utf-8`
- `Content-Disposition: attachment; filename="..."`
- `Cache-Control: no-store`
- `X-Content-Type-Options: nosniff`

## UI

In `Impostazioni`, la card backup usa ora la route verificata.

Il CSV transazioni esistente resta invariato.

Copy aggiornato:

- "Backup completo Aurora"
- "Scarica backup completo Aurora"

## Compatibilita

- Export CSV transazioni invariato.
- Report/export esistenti invariati.
- Import esistenti invariati.
- Nessun restore introdotto.
- Il vecchio dump JSON client-side viene sostituito dall'azione Backup v1
  verificata nella stessa area UI.

## Test

Nuovi test aggiunti: 17.

Coprono:

- filename;
- mapper;
- null/default;
- immutabilita;
- rimozione `user_id`;
- esclusione `ip_address`;
- relazioni transfer;
- record counts;
- checksum;
- validazione pre-download;
- blocco su backup invalido;
- route autenticata;
- route non autenticata;
- query fallita;
- assenza scritture/RPC;
- response download.

## Verifiche

- `npm run test:run`: verde.
  - Test file: 11 passed, 1 skipped.
  - Test: 168 passed, 14 skipped, 182 totali.
- `npm run test:coverage`: verde.
  - Statements: 97.6%.
  - Branches: 89.37%.
  - Functions: 100%.
  - Lines: 97.38%.
- `npm run build`: verde.
  - Route `/api/backup/export` compilata come dinamica.
  - TypeScript completato durante la build.
- `git diff --check`: verde, con soli warning CRLF sui file modificati.
- `npm run lint`: non verde per problema noto dello script `next lint`.
  - Errore: `Invalid project directory provided, no such directory: ...\Aurora-5.0\lint`.
  - Nessuna configurazione lint e' stata modificata.
- Script `typecheck`: non presente in `package.json`.

## Limiti

- Nessun restore.
- Nessun upload.
- Nessun dry-run restore.
- Nessuna verifica end-to-end con Supabase reale in questo sprint.
- `birthday_reminder_log` puo risultare vuota per policy RLS service-role-only:
  lo sprint non aggira RLS.
- I file fisici dietro `receipt_url` non sono inclusi.

## Stato finale

Non sono stati eseguiti commit o push.
