# Sprint 5 - Setup Supabase locale

## Scopo

Questo setup serve solo a validare il motore contabile su un database isolato. Non usare `.env.local` di produzione e non collegare il progetto Supabase cloud reale.

## Prerequisiti

- Docker Desktop avviato.
- Supabase CLI disponibile tramite `npx supabase@latest`.
- Repository Aurora 5.0 aggiornato.

## Avvio ambiente locale

```powershell
npx supabase@latest start
npx supabase@latest db reset
```

Recuperare URL e chiavi locali:

```powershell
npx supabase@latest status
```

Impostare variabili dedicate ai test, mai quelle di produzione:

```powershell
$env:SUPABASE_TEST_URL="http://127.0.0.1:54321"
$env:SUPABASE_TEST_ANON_KEY="<local anon key>"
$env:SUPABASE_TEST_SERVICE_ROLE_KEY="<local service role key>"
$env:SUPABASE_TEST_USER_A_JWT="<jwt locale utente A>"
$env:SUPABASE_TEST_USER_B_JWT="<jwt locale utente B>"
```

## Fixture deterministica

La fixture TypeScript si trova in:

`tests/integration/fixtures/supabase-accounting-fixture.ts`

Contiene SQL locale con:

- utente A e utente B;
- almeno 3 conti per utente A;
- categorie e sottocategorie;
- entrate, uscite, giroconti legacy, giroconti nuovi;
- transazioni senza categoria;
- pagamenti carta;
- righe con stessa data/importo ma descrizioni diverse;
- storico su due anni.

Applicare la fixture solo al DB locale con `psql` o SQL editor locale Supabase. Non applicarla a produzione.

## Esecuzione test

```powershell
npm run test:integration
```

Se una variabile `SUPABASE_TEST_*` manca, la suite viene saltata esplicitamente per evitare accessi accidentali a produzione.

## Arresto e reset

```powershell
npx supabase@latest stop
```

Per distruggere i dati locali, usare il reset locale o rimuovere i volumi Docker Supabase locali secondo la documentazione Supabase CLI.
