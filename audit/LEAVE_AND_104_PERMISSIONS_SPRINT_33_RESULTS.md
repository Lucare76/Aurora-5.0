# Sprint 33 - Ferie e permessi 104

## Executive summary

Sprint 33 introduce il modulo privato **Ferie e permessi** su `/leave`.

Il modulo e separato dalla contabilita: non usa conti, movimenti, budget, report finanziari, Financial Health, Affordability, ADI, Aurora risparmi o Financial Assistant.

Accesso, pagina, API e command menu sono disponibili solo per l'account autorizzato lato server tramite `PRIVATE_HR_ACCOUNT_EMAIL`; in assenza della variabile dedicata viene usato il fallback controllato `PRIVATE_FINANCE_ACCOUNT_EMAIL`.

## Migration

Creata migration locale:

- `supabase/migrations/00033_leave_and_104_permissions.sql`

Oggetti creati:

- `public.leave_settings`
- `public.leave_entries`
- policy RLS ownership su `auth.uid() = user_id`
- indici per storico utente/data e utente/tipo/data
- trigger `updated_at` idempotenti

Nessuna migration remota applicata.

## Schema

`leave_settings` conserva solo impostazioni configurabili:

- ferie annue disponibili, default 30
- permessi 104 mensili disponibili, default 24
- timezone

`leave_entries` conserva solo eventi:

- tipo `VACATION` o `PERMIT_104`
- date
- giorni oppure ore
- orario opzionale per permessi
- nota opzionale

Residui, aggregati e percentuali non vengono salvati.

## RLS e accesso privato

Le API `/api/leave/*` richiedono:

- utente autenticato;
- accesso HR autorizzato;
- ownership tramite `user_id`.

Utenti non autorizzati non vedono la voce di navigazione, non vedono i comandi rapidi e ricevono 403/404.

## Dashboard, storico, calendario e statistiche

La pagina `/leave` include:

- card Ferie con disponibili, usate, residue e percentuale;
- card Permessi 104 con disponibili, usate, residue e percentuale;
- ultima ferie, prossime ferie, ultimo permesso, ore 104 anno, giorni ferie anno;
- storico ferie filtrato per anno;
- storico permessi filtrato per mese/anno;
- calendario interno separato;
- statistiche sintetiche;
- dialog creazione/modifica;
- eliminazione;
- impostazioni configurabili.

## PDF

Creato export PDF server-side:

- ferie annuali;
- permessi 104 mensili;
- riepilogo annuale.

Footer incluso:

> Documento generato da Aurora

I PDF non vengono salvati nel database.

## Backup e restore

Backup JSON esteso con collezioni opzionali:

- `leaveSettings`
- `leaveEntries`

I backup precedenti restano compatibili perche i campi sono opzionali.

Restore supportato con rimappatura `user_id` verso l'utente corrente. Il restore dei dati Ferie/104 resta separato dalle tabelle finanziarie e non modifica conti, saldi o transazioni.

## Test

Test aggiunti o aggiornati:

- calcoli ferie annuali e permessi mensili;
- separazione anni e mesi;
- validazione Zod dei payload API;
- migration statica RLS e non distruttiva;
- PDF smoke test;
- visibilita nav e command menu HR;
- helper accesso HR;
- backup export Ferie/104.

Per stabilizzare la coverage V8 su import route preesistenti e test molto pesanti, `vitest.config.ts` ora usa `testTimeout: 60000`.

## Verifiche

Ultimo esito registrato:

- `npx tsc --noEmit`: verde
- `npx vitest run`: 1530 passed, 14 skipped
- `npm run test:coverage`: 1530 passed, 14 skipped
- Coverage: statements 84.42%, branches 76.25%, functions 87.55%, lines 86.67%

- `npm run build`: verde
- `git diff --check`: verde, con soli warning CRLF di Git su Windows

## Limiti

- Il calendario interno mostra una griglia mensile semplice e non calcola festivita italiane, come richiesto.
- Non esiste riporto automatico ferie o permessi.
- Il restore Ferie/104 e separato dal restore RPC finanziario per non modificare il motore contabile.

## Conferme

- Accesso solo all'account autorizzato.
- Ferie 30 giorni/anno configurabili.
- Permessi 104 24 ore/mese configurabili.
- Anni indipendenti.
- Mesi indipendenti.
- Nessun riporto automatico.
- Nessuna modifica ai dati finanziari.
- Nessuna integrazione AI.
- Nessuna migration remota.
- Nessun commit.
- Nessun push.
- Nessun deploy.
