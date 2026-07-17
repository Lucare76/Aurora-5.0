# Sprint 5 - Risultati

## Ambiente

Ambiente target: Supabase CLI locale o clone dedicato.

Esito ambiente in questa sessione:

- `npx supabase@latest status`: timeout, ambiente locale non confermato.
- `npx supabase@latest --version`: timeout, CLI non verificata nella sessione.
- Nessuna variabile `SUPABASE_TEST_*` era configurata.

La suite di integrazione non usa `.env.local`; legge solo variabili `SUPABASE_TEST_*` esplicite:

- `SUPABASE_TEST_URL`
- `SUPABASE_TEST_ANON_KEY`
- `SUPABASE_TEST_SERVICE_ROLE_KEY`
- `SUPABASE_TEST_USER_A_JWT`
- `SUPABASE_TEST_USER_B_JWT`

Se una variabile manca, i test integration vengono saltati per prevenire accessi accidentali alla produzione.

## File creati o modificati

Creati:

- `tests/integration/fixtures/supabase-accounting-fixture.ts`
- `tests/integration/supabase-accounting.integration.test.ts`
- `supabase/migrations_draft/00011_normalize_transfer_model_dry_run.sql`
- `audit/SPRINT_5_PLAN.md`
- `audit/SPRINT_5_RESULTS.md`
- `audit/SPRINT_5_LOCAL_SUPABASE_SETUP.md`
- `audit/SPRINT_5_MIGRATION_DRY_RUN_RESULTS.md`
- `audit/SPRINT_5_ROLLBACK_PLAN.md`
- `audit/SPRINT_5_MIGRATION_VERIFICATION.sql`

Modificato:

- `package.json` con script `test:integration`.
- `vitest.config.ts` con `testTimeout: 10000` per stabilizzare coverage sotto strumentazione V8.

## Copertura funzionale della suite integration

La suite copre:

- fixture deterministica e isolamento utente A/B;
- RLS in lettura cross-user;
- CREATE income;
- CREATE expense;
- CREATE transfer;
- UPDATE income;
- UPDATE expense;
- UPDATE transfer;
- DELETE income;
- DELETE expense;
- DELETE transfer;
- neutralita' patrimonio dei giroconti;
- ownership negativa via RPC;
- aggregati dashboard/report da righe Supabase reali;
- export senza merge di righe con stessa data/importo.

## Dry-run migrazione

Draft creato in `supabase/migrations_draft/`.

Non applicato a produzione.

Dry-run locale non eseguito per assenza di ambiente Supabase locale verificabile nella sessione.

## Comandi eseguiti

```text
npm run test:run
```

Esito: verde.

- Test files: 6 passed, 1 skipped.
- Tests: 96 passed, 14 skipped, 110 totali.
- I 14 skipped sono la suite integration, protetta da variabili `SUPABASE_TEST_*`.

```text
npm run test:coverage
```

Esito: verde.

- Statements: 97.6%.
- Branches: 89.37%.
- Functions: 100%.
- Lines: 97.38%.

```text
npm run build
```

Esito: verde.

```text
npm run test:integration
```

Esito: verde con skip controllato.

- Test files: 1 skipped.
- Tests: 14 skipped.
- Motivo: ambiente Supabase isolato non configurato con `SUPABASE_TEST_*`.

## Conferme vincoli

- Produzione non toccata.
- Dati reali non letti e non modificati.
- RPC di produzione non modificate.
- Migration ufficiali in `supabase/migrations/` non modificate.
- UI non modificata.
- UX categorie espandibili non implementata nello Sprint 5.
- Nessun commit.
- Nessun push.
