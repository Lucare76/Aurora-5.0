# Backup Sprint 4 - Results

## Sintesi

Implementato dry-run di ripristino Aurora Backup v1 senza scritture.

Il flusso permette di selezionare un file JSON, inviarne il contenuto a una
route server autenticata, validare formato/checksum/record counts, leggere uno
snapshot read-only dell'utente corrente, simulare strategia ID, collisioni,
ordine restore, anteprima contabile e readiness.

Non e' stato implementato restore reale.

## File creati

- `src/lib/backup/restore/types.ts`
- `src/lib/backup/restore/current-state.ts`
- `src/lib/backup/restore/account-empty-check.ts`
- `src/lib/backup/restore/id-mapping.ts`
- `src/lib/backup/restore/collision-detection.ts`
- `src/lib/backup/restore/restore-order.ts`
- `src/lib/backup/restore/accounting-preview.ts`
- `src/lib/backup/restore/transfer-validation.ts`
- `src/lib/backup/restore/dry-run.ts`
- `src/lib/backup/restore/report.ts`
- `src/lib/backup/restore/index.ts`
- `src/app/api/backup/restore/dry-run/route.ts`
- `tests/unit/backup/backup-restore-dry-run.test.ts`
- `tests/api/backup-restore-dry-run-route.test.ts`
- `audit/BACKUP_SPRINT_4_PLAN.md`
- `audit/BACKUP_SPRINT_4_RESULTS.md`

## File modificati

- `src/lib/backup/index.ts`
- `src/app/(app)/settings/page.tsx`

## Endpoint

Creato:

- `POST /api/backup/restore/dry-run`

Metodo non supportato:

- `GET /api/backup/restore/dry-run` restituisce 405.

Header:

- `Cache-Control: no-store`
- `X-Content-Type-Options: nosniff`
- `Content-Type: application/json` tramite `NextResponse.json`

## Limite massimo file

10 MB.

Il server controlla:

- dimensione body richiesta;
- dimensione contenuto backup;
- estensione `.json`;
- parsing JSON controllato.

Nessun file viene salvato su storage o disco.

## Definizione account vuoto

Bloccanti:

- conti;
- categorie non default;
- transazioni;
- budget;
- ricorrenze;
- prestiti;
- pagamenti prestiti;
- compleanni.

Ignorati:

- profilo tecnico;
- categorie default automatiche;
- audit log;
- birthday reminder log.

Un account con dati contabili non e' considerato vuoto.

## Snapshot

Lo snapshot read-only include campi minimi per:

- profilo;
- conti;
- categorie;
- transazioni;
- budget;
- ricorrenze;
- prestiti;
- pagamenti prestiti;
- compleanni;
- birthday reminder log;
- audit log.

Le query usano il client Supabase normale con sessione utente e RLS. Non viene
usato service role.

## Autenticazione e RLS

La route chiama `supabase.auth.getUser()`.

Non accetta:

- `user_id`;
- nomi tabella;
- SQL;
- override RLS;
- modalita restore diverse;
- flag per ignorare errori.

## Strategia ID

Modalita attiva:

- `empty_account_restore`

Strategia:

- preservare ID originali se lo snapshot non contiene collisioni;
- marcare `blocked` in caso di collisione UUID;
- ignorare `user_id` del backup;
- associare teoricamente ownership futura all'utente autenticato.

## Collisioni e duplicati

Rilevati:

- UUID duplicati interni;
- UUID gia presenti nello snapshot;
- conto con stessa chiave logica;
- categoria con stesso parent/nome/tipo;
- movimento con fingerprint equivalente;
- pagamento prestito equivalente;
- compleanno equivalente;
- reminder log equivalente.

## Relazioni

Il dry-run riusa `validateBackupRelationships()` del modulo Backup Sprint 2 e
converte le issue nel report di restore.

Le missing references diventano bloccanti.

## Ordine piano

Il piano simulato e' deterministico:

1. profile
2. accounts
3. parentCategories
4. childCategories
5. loans
6. recurringRules
7. normalTransactions
8. transferTransactions
9. loanPayments
10. budgets
11. birthdays
12. birthdayReminderLog
13. auditLogs

Ogni step usa `operation: simulate_create`.

## Anteprima contabile

Calcolata dal backup:

- numero movimenti;
- totale entrate;
- totale uscite;
- netto;
- patrimonio previsto;
- saldi backup per conto;
- netto movimenti per conto;
- movimenti senza categoria;
- movimenti con riferimenti mancanti;
- riepilogo mensile;
- capitale residuo prestiti;
- conteggio trasferimenti.

Non vengono modificati saldi reali.

## Trasferimenti

Classificati:

- `valid`;
- `legacy_recoverable`;
- `ambiguous`;
- `blocked`.

Il dry-run blocca:

- peer assente;
- peer orfano;
- origine e destinazione uguali;
- coppia legacy ambigua.

Non corregge automaticamente trasferimenti ambigui.

## Readiness

Possibili esiti:

- `ready`;
- `ready_with_warnings`;
- `blocked`.

`blocked` viene prodotto se:

- almeno una issue error;
- account corrente non vuoto;
- backup non validabile;
- checksum errato;
- collisione bloccante;
- relazione mancante;
- trasferimento bloccante o ambiguo.

## UI

In `Impostazioni` aggiunta card:

- "Verifica un backup"

Flusso:

1. selezione file JSON;
2. mostra nome e dimensione;
3. pulsante "Verifica backup";
4. caricamento;
5. report finale.

Il report mostra:

- readiness;
- versione;
- checksum;
- account vuoto/non vuoto;
- record;
- record creabili;
- collisioni;
- duplicati;
- errori;
- entrate/uscite/patrimonio previsti;
- trasferimenti;
- piano sintetico.

Non sono stati aggiunti pulsanti:

- Ripristina;
- Forza;
- Ignora errori;
- Sostituisci dati;
- Unisci dati.

## Test

Nuovi test: 24.

Coprono:

- account vuoto;
- account non vuoto;
- categorie default ignorabili;
- mapping ID;
- collisioni;
- duplicati logici;
- piano deterministico;
- anteprima contabile;
- readiness;
- relazioni mancanti;
- trasferimenti validi, orfani e legacy;
- endpoint autenticato/non autenticato;
- metodo non supportato;
- JSON malformato;
- file non JSON;
- file troppo grande;
- backup invalido;
- checksum errato;
- snapshot fallito;
- assenza scritture/RPC nel mock.

## Verifiche

- `npm run test:run`: verde.
  - Test file: 13 passed, 1 skipped.
  - Test: 192 passed, 14 skipped, 206 totali.
- `npm run test:coverage`: verde.
  - Statements: 97.6%.
  - Branches: 89.37%.
  - Functions: 100%.
  - Lines: 97.38%.
- `npm run build`: verde.
  - Route `/api/backup/restore/dry-run` compilata come dinamica.
  - TypeScript completato durante build.
- `npm run lint`: non verde per problema noto dello script `next lint`.
  - Errore: `Invalid project directory provided, no such directory: ...\Aurora-5.0\lint`.
  - Nessuna configurazione lint modificata.
- `git diff --check`: verde, con soli warning CRLF.
- Script `typecheck`: non presente in `package.json`.

## Controllo scritture

Eseguita scansione:

`rg "\.(insert|update|delete|upsert)\(|\.rpc\(" src/app/api/backup/restore src/lib/backup/restore`

Risultato: nessuna occorrenza nel nuovo flusso restore/dry-run.

## Limiti

- Nessun restore reale.
- Nessun upload persistente.
- Nessun merge.
- Nessun replace-all.
- Nessun dry-run contro Supabase reale oltre ai test mock.
- L'anteprima saldo usa i saldi snapshot del backup, non ricalcola una
  ricostruzione storica completa dei saldi reali.
- La UI non ha test browser dedicati; la copertura principale e' su motore e
  API.

## Stato finale

Non sono stati eseguiti commit o push.
