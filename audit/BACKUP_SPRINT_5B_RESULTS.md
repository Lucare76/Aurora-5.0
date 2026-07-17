# Backup Sprint 5B - Results

## Sintesi

Sprint 5B ha ispezionato l'ambiente Supabase e ha preparato la validazione
DB/RPC reale. L'ambiente corrente non permette l'esecuzione effettiva dei test
database per assenza di Docker funzionante/installato.

Risultato operativo:

- restore reale disabilitato di default tramite feature flag;
- migration Sprint 5 corretta staticamente;
- aggiunti test statici sui guardrail della RPC;
- aggiunto harness SQL per validazione locale/staging;
- test applicativi e build da rieseguire a fine sprint.

## Ispezione ambiente

- Cartella `supabase/`: presente.
- `supabase/config.toml`: presente.
- `project_id`: `atguroqvidhhebwdnzpu`.
- Supabase CLI: `2.109.1`.
- `npx supabase@latest status`: fallisce per Docker engine non disponibile.
- `docker --version`: comando non riconosciuto.
- `docker ps`: comando non riconosciuto.

Errore Supabase status:

`failed to inspect container health ... open //./pipe/docker_engine: Impossibile trovare il file specificato`

## Decisione UI

Poiche rollback/concorrenza non sono stati provati realmente su DB, il restore
reale resta disabilitato di default.

Flag richiesti per abilitarlo dopo validazione:

- server: `ENABLE_BACKUP_RESTORE_REAL=true`
- client: `NEXT_PUBLIC_ENABLE_BACKUP_RESTORE_REAL=true`

Dry-run e verifica backup restano disponibili.

## Correzioni migration/RPC

File modificato:

- `supabase/migrations/00011_add_atomic_empty_account_restore.sql`

Correzioni:

- gestione esplicita delle categorie default tecniche in account vuoto;
- coalesce su timestamp/campi not-null opzionali;
- verifica finale dei conteggi estesa a budget, ricorrenze, prestiti,
  pagamenti, compleanni e reminder log;
- allineamento fra dry-run e RPC per account con sole categorie default.

## File creati

- `tests/unit/backup/backup-restore-migration-static.test.ts`
- `audit/BACKUP_SPRINT_5B_DB_VALIDATION.sql`
- `audit/BACKUP_SPRINT_5B_RESULTS.md`

## File modificati

- `supabase/migrations/00011_add_atomic_empty_account_restore.sql`
- `src/app/(app)/settings/page.tsx`
- `src/app/api/backup/restore/prepare/route.ts`
- `src/app/api/backup/restore/route.ts`
- `tests/api/backup-restore-route.test.ts`

## Test/harness aggiunti

- `tests/unit/backup/backup-restore-migration-static.test.ts`
- `audit/BACKUP_SPRINT_5B_DB_VALIDATION.sql`

I test statici verificano:

- presenza RPC/tabelle token/run;
- `SECURITY DEFINER`;
- `search_path`;
- uso `auth.uid()`;
- assenza SQL dinamico;
- assenza input tabella/user/force/merge/replace;
- token monouso;
- lock;
- ricontrollo account vuoto;
- verifica conteggi.

## Prove DB reali

Non eseguite in questo ambiente.

Motivo: Docker non installato/non disponibile, quindi Supabase locale non puo'
avviarsi. Non sono state applicate migration a produzione.

Comando eseguito:

`npx supabase@latest db reset`

Esito:

`Docker Desktop is a prerequisite for local development`

## Criteri non ancora soddisfatti

Restano da eseguire in locale/staging:

- applicazione migration da zero;
- creazione RPC;
- verifica grant reali;
- chiamata authenticated;
- chiamata anon rifiutata;
- restore valido;
- ownership corretta;
- rollback reale su errore a meta restore;
- token monouso reale;
- concorrenza reale;
- account non vuoto bloccato dentro transazione;
- saldi/patrimonio reali post restore.

## Verifiche applicative

- `npm run test:run`: verde.
  - Test file: 15 passed, 1 skipped.
  - Test: 209 passed, 14 skipped, 223 totali.
- `npm run test:coverage`: verde.
  - Statements: 97.6%.
  - Branches: 89.37%.
  - Functions: 100%.
  - Lines: 97.38%.
- `npm run build`: verde.
- `git diff --check`: verde, con soli warning CRLF.
- `npm run lint`: non verde per problema noto dello script `next lint`.
  - Errore: `Invalid project directory provided, no such directory: ...\Aurora-5.0\lint`.
- Script `typecheck`: non presente; TypeScript passa durante `npm run build`.

## Stato

Sprint 5B non dichiara il restore reale validato. Il sistema rimane protetto dal
feature flag fino al superamento delle prove DB/RPC reali.

Nessun commit o push eseguito.
