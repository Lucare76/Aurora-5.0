# Backup Sprint 4 - Plan

## Architettura

Lo sprint introduce un dry-run di ripristino senza scritture:

- modulo puro `src/lib/backup/restore/`;
- snapshot server read-only tramite Supabase session client;
- endpoint `POST /api/backup/restore/dry-run`;
- UI in Impostazioni per selezionare un file JSON e visualizzare il report.

Il motore puro riceve backup gia validato e snapshot corrente, poi restituisce
readiness, collisioni, mapping ID, piano simulato e anteprima contabile.

## File da creare

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
- `audit/BACKUP_SPRINT_4_RESULTS.md`

## File da modificare

- `src/lib/backup/index.ts`
- `src/app/(app)/settings/page.tsx`

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

Ignorabili:

- profilo tecnico;
- categorie default automatiche;
- audit log;
- reminder log compleanni.

Un account con dati contabili non e mai vuoto.

## Snapshot necessario

Lo snapshot contiene solo dati minimi per:

- conteggi;
- verifica account vuoto;
- collisioni UUID;
- duplicati logici;
- fingerprint movimenti;
- piano e anteprima.

Non viene restituito alla UI con descrizioni/note complete.

## Strategia collisioni e ID

Modalita attiva: `empty_account_restore`.

- ID originali proposti come `preserve`;
- collisione UUID con snapshot: `blocked`;
- `user_id` nel backup ignorato;
- ownership futura teorica associata all'utente autenticato.

## Anteprima contabile

Calcola dal backup:

- numero movimenti;
- entrate;
- uscite;
- saldo netto;
- saldo previsto per conto;
- patrimonio previsto;
- trasferimenti;
- movimenti senza categoria;
- riepilogo mensile;
- prestiti residui.

## Sicurezza

- nessun service role;
- nessun user id accettato dal client;
- max file 10 MB;
- nessun payload finanziario nei log;
- nessuna scrittura;
- nessun pulsante restore.

## Rischi

- `birthday_reminder_log` puo non essere visibile per RLS.
- Il controllo saldo previsto usa il saldo snapshot nel backup come fonte per
  il restore futuro; eventuale ricalcolo da storico va approfondito prima del
  restore reale.
- I trasferimenti legacy recuperabili restano warning, non correzioni.
