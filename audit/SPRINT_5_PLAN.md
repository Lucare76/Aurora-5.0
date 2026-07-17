# Sprint 5 - Piano

## Obiettivo

Validare il motore contabile di Aurora 5.0 su un database Supabase isolato, senza usare produzione e senza modificare dati reali, schema di produzione o RPC di produzione.

## Ambiente scelto

Approccio primario: Supabase CLI locale.

Motivo:

- usa migration del repository;
- isola i dati dal progetto cloud;
- permette test reali su Postgres, RLS e RPC;
- puo' essere resettato e distrutto.

Fallback: se Docker/Supabase locale non e' disponibile nella macchina, la suite di integrazione resta pronta ma viene eseguita solo quando sono presenti variabili ambiente locali esplicite.

## File da creare

- `audit/SPRINT_5_PLAN.md`
- `audit/SPRINT_5_RESULTS.md`
- `audit/SPRINT_5_LOCAL_SUPABASE_SETUP.md`
- `audit/SPRINT_5_MIGRATION_DRY_RUN_RESULTS.md`
- `audit/SPRINT_5_ROLLBACK_PLAN.md`
- `audit/SPRINT_5_MIGRATION_VERIFICATION.sql`
- `supabase/migrations_draft/00011_normalize_transfer_model_dry_run.sql`
- `tests/integration/supabase-accounting.integration.test.ts`
- `tests/integration/fixtures/supabase-accounting-fixture.ts`

## File da modificare

- `package.json`
- eventuale `vitest.config.ts` solo se serve separare test integration.

## Fixture deterministica

Utenti:

- utente A;
- utente B.

Utente A:

- 3 conti;
- 4+ categorie;
- sottocategorie;
- income;
- expense;
- transfer storico;
- transfer nuovo;
- movimenti senza categoria;
- pagamenti carta;
- duplicati stessa data/importo con descrizioni diverse;
- almeno due anni di storico.

Utente B:

- dati minimi per test ownership/RLS.

## Test integrazione previsti

Suite separata:

- CREATE income;
- CREATE expense;
- CREATE transfer;
- UPDATE income;
- UPDATE expense;
- UPDATE transfer;
- DELETE income;
- DELETE expense;
- DELETE transfer;
- patrimonio;
- neutralita transfer;
- categorie/report;
- ownership negata;
- RLS cross-user;
- export/parita con `AppTransaction`.

## Vincoli tecnici

- Nessuna query verso produzione.
- La suite richiede `SUPABASE_TEST_URL` e `SUPABASE_TEST_SERVICE_ROLE_KEY`.
- Se le variabili non sono presenti, la suite salta in modo esplicito e documentato.
- Nessun test deve usare `.env.local` di produzione.

## Verifiche finali

- `npm run test:run`
- `npm run test:coverage`
- `npm run build`
- `npm run test:integration` se ambiente locale disponibile.

## Criterio UX opzionale

La miglioria categorie espandibili non viene implementata in Sprint 5 perche' il testo Sprint 5 dice esplicitamente di non implementare UX e rimanda lo Sprint 6 alla UX.
