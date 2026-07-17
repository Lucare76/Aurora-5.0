# Backup Sprint 3 - Plan

## Flusso attuale

La pagina `src/app/(app)/settings/page.tsx` espone due export:

- CSV transazioni, client-side, pensato per analisi e consultazione.
- JSON "Backup completo", client-side, basato su query Supabase dirette e
  formato non versionato.

Il backup JSON attuale:

- usa `select('*')` su molte tabelle;
- non include profilo, audit log e reminder compleanni;
- non calcola record counts;
- non calcola checksum;
- non usa il validatore Aurora Backup v1;
- non blocca il download se il payload e' invalido.

## Flusso futuro

Lo Sprint 3 introduce un export dedicato:

1. route server autenticata;
2. recupero dati dell'utente corrente tramite Supabase anon/session client;
3. query esplicite e leggibili;
4. mapping puro verso Aurora Backup v1;
5. calcolo record counts con modulo Sprint 2;
6. calcolo checksum canonico con modulo Sprint 2;
7. validazione pre-download con `inspectAuroraBackup`;
8. download JSON con header sicuri.

Il vecchio export CSV resta invariato. L'azione backup completa viene sostituita
da una chiamata alla route verificata.

## File da creare

- `src/lib/backup/export/fetch-user-backup-data.ts`
- `src/lib/backup/export/map-backup-data.ts`
- `src/lib/backup/export/generate-aurora-backup.ts`
- `src/lib/backup/export/filename.ts`
- `src/lib/backup/export/index.ts`
- `src/app/api/backup/export/route.ts`
- `tests/unit/backup/backup-export.test.ts`
- `tests/api/backup-export-route.test.ts`
- `audit/BACKUP_SPRINT_3_RESULTS.md`

## File da modificare

- `src/app/(app)/settings/page.tsx`
- `src/lib/backup/index.ts`

## Entita incluse

- `profiles`
- `accounts`
- `categories`
- `transactions`
- `budgets`
- `recurring_rules`
- `loans`
- `loan_payments`
- `birthdays`
- `birthday_reminder_log`
- `audit_logs`

## Entita escluse

- auth metadata, password, token, cookie, sessioni;
- service role key;
- file fisici collegati a `receipt_url`;
- import metadata non presente nel formato Backup v1;
- IP address degli audit log, per ridurre dati personali non necessari.

## Strategia compatibilita

- CSV transazioni invariato.
- Report/export esistenti invariati.
- Import esistenti invariati.
- Nessun restore o upload introdotto.
- Il backup completo diventa Aurora Backup v1 verificato, con copy UI esplicito.
