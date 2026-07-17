# Backup Sprint 5 - Results

## Sintesi

Implementato ripristino reale Aurora Backup v1 solo su account vuoto.

Il restore e' consentito esclusivamente quando:

- utente autenticato;
- backup Aurora Backup v1 valido;
- checksum valido;
- dry-run server-side ricalcolato;
- `readiness === "ready"`;
- token breve monouso valido;
- frase conferma esatta;
- RPC atomica completa con successo.

## File creati

- `supabase/migrations/00011_add_atomic_empty_account_restore.sql`
- `src/lib/backup/restore/prepare.ts`
- `src/lib/backup/restore/restore-payload.ts`
- `src/app/api/backup/restore/prepare/route.ts`
- `src/app/api/backup/restore/route.ts`
- `tests/api/backup-restore-route.test.ts`
- `audit/BACKUP_SPRINT_5_PLAN.md`
- `audit/BACKUP_SPRINT_5_RESULTS.md`
- `audit/BACKUP_RESTORE_ATOMICITY_PROOF.md`
- `audit/BACKUP_RESTORE_SECURITY_REVIEW.md`

## File modificati

- `src/app/(app)/settings/page.tsx`
- `src/lib/backup/restore/index.ts`
- `src/types/database.ts`

## Migration creata

`supabase/migrations/00011_add_atomic_empty_account_restore.sql`

Crea:

- `backup_restore_tokens`;
- `backup_restore_runs`;
- RPC `restore_aurora_backup_v1_empty_account`.

## RPC creata

`restore_aurora_backup_v1_empty_account(p_token_id uuid, p_token text, p_backup jsonb)`

## SECURITY

Scelta: `SECURITY DEFINER`.

Motivazione:

- serve transazione unica;
- `birthday_reminder_log` e `audit_logs` richiedono privilegi non disponibili a
  normali insert client;
- la funzione usa `auth.uid()` obbligatorio e non accetta user target.

## Strategia atomica

Endpoint restore chiama una sola RPC. La RPC:

- valida token;
- acquisisce advisory lock per utente;
- ricontrolla account vuoto;
- consuma token;
- inserisce dati;
- verifica conteggi finali;
- solleva eccezione su errore.

Qualsiasi eccezione provoca rollback della chiamata PostgreSQL.

## Prova rollback

Eseguiti test API mock su fallimento RPC e verifica che l'endpoint chiami una
sola RPC atomica.

Non e' stato possibile eseguire test DB/RPC reali in questo ambiente:

`npx supabase@latest migration list` fallisce con `LegacyProjectNotLinkedError`.

La migration non e' stata applicata a produzione.

## Autenticazione e ownership

Endpoint:

- `supabase.auth.getUser()`.

RPC:

- `auth.uid()`;
- ownership forzata a `auth.uid()`;
- `user_id` del backup ignorato.

## Lock e concorrenza

RPC usa:

- `pg_advisory_xact_lock(hashtextextended(v_uid::text, 20260717))`;
- `select ... for update` sul token;
- `used_at` monouso.

## Token

- generato server-side;
- hash SHA-256 salvato nel DB;
- durata 5 minuti;
- legato a utente/checksum/schemaVersion/modalita;
- monouso;
- non salvato in localStorage dalla UI.

## Endpoint

- `POST /api/backup/restore/prepare`
- `POST /api/backup/restore`

## UI

In Impostazioni:

- dopo dry-run `ready`, pulsante `Prepara conferma`;
- mostra checksum abbreviato e scadenza;
- richiede frase esatta `RIPRISTINA AURORA`;
- pulsante `Ripristina backup`;
- riepilogo finale dopo successo.

Nessun pulsante:

- merge;
- replace;
- force;
- ignore warnings.

## Ordine inserimento

1. token/lock;
2. profilo;
3. conti;
4. categorie padre;
5. sottocategorie;
6. prestiti;
7. ricorrenze;
8. transazioni normali;
9. trasferimenti;
10. pagamenti prestiti;
11. budget;
12. compleanni;
13. birthday reminder log;
14. audit log marcati `RESTORED_*`;
15. verifiche finali.

## Strategia ID

Preserva ID originali. Nessun remap. Collisione o impossibilita di preservare
ID blocca il restore.

## Gestione profilo/default

Profilo tecnico aggiornato in modo ristretto.

Categorie default preesistenti bloccano se il backup contiene categorie, per
evitare duplicati ambigui.

## Trasferimenti

Restore reale accetta solo backup con dry-run `ready`. Trasferimenti ambigui,
orfani o legacy warning bloccano prima del restore reale.

## Errori controllati

Gestiti:

- `UNAUTHENTICATED`
- `INVALID_BACKUP`
- `PAYLOAD_TOO_LARGE`
- `RESTORE_NOT_READY`
- `CONFIRMATION_REQUIRED`
- `TOKEN_INVALID`
- `TOKEN_EXPIRED`
- `TOKEN_ALREADY_USED`
- `ACCOUNT_NOT_EMPTY`
- `ACCOUNTING_MISMATCH`
- `RESTORE_ROLLED_BACK`
- `INTERNAL_ERROR`

## Test

Nuovi test Sprint 5: 8.

Totale:

- `npm run test:run`: 200 passed, 14 skipped, 214 totali.
- `npm run test:coverage`: Statements 97.6%, Branches 89.37%, Functions 100%, Lines 97.38%.
- `npm run build`: verde.

## Lint e typecheck

- `npm run lint`: fallisce per problema noto `next lint`.
- TypeScript passa durante `npm run build`.
- Script `typecheck`: non presente.

## Supabase CLI

`npx supabase@latest migration list` fallisce:

`LegacyProjectNotLinkedError: Cannot find project ref. Have you run supabase link?`

Non sono stati eseguiti reset DB, migration push o restore su produzione.

## Limiti

- Test DB/RPC reali non eseguiti.
- Prova rollback reale da completare in Supabase locale/linkato.
- Nessun merge/replace/force.
- Nessun restore con warning.
- Nessun restore produzione eseguito.

## Stato finale

Non sono stati eseguiti commit o push.
