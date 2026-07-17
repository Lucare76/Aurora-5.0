# Backup Sprint 2 - Results

## Sintesi

Sprint implementato senza modificare database, migration, Supabase, RLS, RPC,
API, UI, import/export esistenti, report, AppTransaction, calcoli contabili,
saldi, patrimonio o transazioni reali.

Il lavoro introduce un formato backup versionato Aurora Backup v1 e un
validatore puro, deterministico e no-side-effect. Il validatore opera solo su
payload in memoria e restituisce esiti strutturati, senza leggere o scrivere
database o file applicativi.

## File creati

- `src/lib/backup/constants.ts`
- `src/lib/backup/types.ts`
- `src/lib/backup/schema.ts`
- `src/lib/backup/issue.ts`
- `src/lib/backup/security.ts`
- `src/lib/backup/normalize.ts`
- `src/lib/backup/record-counts.ts`
- `src/lib/backup/canonicalize.ts`
- `src/lib/backup/checksum.ts`
- `src/lib/backup/duplicate-detection.ts`
- `src/lib/backup/relationship-validation.ts`
- `src/lib/backup/validate.ts`
- `src/lib/backup/index.ts`
- `tests/fixtures/backup/backup-fixtures.ts`
- `tests/fixtures/backup/valid-minimal-v1.json`
- `tests/fixtures/backup/invalid-root-array.json`
- `tests/fixtures/backup/invalid-wrong-format.json`
- `tests/fixtures/backup/invalid-future-schema-version.json`
- `tests/fixtures/backup/invalid-dangerous-key.json`
- `tests/fixtures/backup/README.md`
- `tests/unit/backup/backup-core.test.ts`
- `audit/BACKUP_SPRINT_2_PLAN.md`
- `audit/BACKUP_SPRINT_2_RESULTS.md`

## Struttura backup v1

Il formato root e' composto da:

- `format: "aurora-backup"`
- `schemaVersion: 1`
- `appVersion`
- `createdAt`
- `exportedBy`
- `defaultCurrency`
- `metadata`
- `data`
- `integrity`

Il blocco `data` contiene collezioni logiche applicative:

- profilo
- conti
- categorie e sottocategorie
- movimenti
- budget
- ricorrenze
- prestiti
- pagamenti prestiti
- compleanni
- reminder compleanni
- audit log

Il blocco `integrity` contiene conteggi, checksum per tabella opzionali e
checksum globale.

## API pubblica

- `validateAuroraBackup(input)`
- `inspectAuroraBackup(input)`
- `normalizeAuroraBackup(backup)`
- `canonicalizeBackup(backup)`
- `computeBackupChecksum(backup)`
- `verifyBackupChecksum(backup)`
- `calculateRecordCounts(backup)`
- `validateRecordCounts(backup)`
- `detectDuplicateIds(backup)`
- `validateBackupRelationships(backup)`

Tutte le funzioni sono pure rispetto a database e ambiente applicativo.

## Canonicalizzazione e checksum

La canonicalizzazione:

- ordina stabilmente le chiavi degli oggetti;
- normalizza timestamp principali;
- ordina le collezioni per `id`;
- rimuove il checksum globale prima del calcolo.

Il checksum globale usa `sha256:<hex>` su JSON canonico. Modifiche a dati,
conteggi o relazioni fanno cambiare il checksum.

## Duplicati

Il validatore distingue:

- stesso `id` nella stessa collezione con contenuto identico: warning;
- stesso `id` nella stessa collezione con contenuto diverso: errore;
- stessa chiave logica categoria (`parent_id`, `type`, `name`): warning.

Gli stessi UUID in collezioni diverse non sono trattati come collisione.

## Relazioni

Sono validate, senza risolvere nulla su database:

- categorie padre mancanti, self-parent e cicli;
- movimenti verso conti mancanti;
- movimenti verso categorie mancanti;
- riferimenti transfer peer legacy;
- budget verso categorie mancanti;
- ricorrenze verso conto/categoria mancanti;
- pagamenti verso prestiti mancanti;
- reminder verso compleanni mancanti.

## Sicurezza e user_id

Il validatore segnala:

- root non oggetto;
- chiavi pericolose `__proto__`, `prototype`, `constructor`;
- `user_id` e `userId` dentro il payload come campi non affidabili.

La presenza di `user_id` nel backup non autorizza alcuna operazione futura:
il restore non e' implementato in questo sprint e dovra' sempre ricontestualizzare
l'utente lato server.

## Limiti residui

- Non implementa restore.
- Non scrive su database.
- Non espone API o UI.
- Non gestisce upload/download.
- Non sostituisce una validazione server-side futura del restore.
- Le fixture statiche coprono casi rappresentativi; i casi combinatori sono
  generati da factory TypeScript nei test.

## Verifiche

- `npm run test:run`: verde.
  - Test file: 9 passed, 1 skipped.
  - Test: 151 passed, 14 skipped, 165 totali.
- `npm run test:coverage`: verde.
  - Statements: 97.6%.
  - Branches: 89.37%.
  - Functions: 100%.
  - Lines: 97.38%.
- `npm run build`: verde.
  - Compilazione production riuscita.
  - TypeScript completato durante la build.
- `git diff --check`: verde.
- `npm run lint`: non verde per configurazione script esistente.
  - Lo script esegue `next lint`.
  - Next/Turbopack interpreta `lint` come directory progetto e restituisce:
    `Invalid project directory provided, no such directory: ...\Aurora-5.0\lint`.
  - Non e' stato modificato lo script lint in questo sprint.
- Script `typecheck`: non presente in `package.json`.

## Stato finale

Non sono stati eseguiti commit o push.
