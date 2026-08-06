# Sprint 29 - Fondazioni assistente finanziario read-only

## Obiettivo

Implementare le fondamenta server-side dell'assistente finanziario Aurora 6.0 senza introdurre UI chat, provider AI, scritture contabili, notifiche o salvataggi di scenario.

## Architettura introdotta

- Feature flag fail-closed: `FINANCIAL_ASSISTANT_ENABLED=false`.
- Libreria modulare in `src/lib/financial-assistant/`.
- Registry intent/tool con soli tool `readOnly: true`.
- Policy scope server-side: personale sempre disponibile, Aurora/ADI solo per `PRIVATE_FINANCE_ACCOUNT_EMAIL`.
- Context builder con query Supabase a colonne esplicite e limiti conservativi.
- Risposte strutturate con evidence e citations interne.
- Redazione e audit log sanitizzato.
- Rate limiter in memoria per utente.
- Policy anti prompt injection e blocco operazioni di scrittura.

## Tool coperti

- Riepilogo finanziario personale.
- Entrate e uscite.
- Spese per categoria.
- Fondo emergenza.
- Spiegazione salute finanziaria.
- Budget.
- Obiettivi.
- Affordability generica, auto, casa, viaggio.
- Decision comparison.
- Riepilogo Aurora autorizzato.
- Riepilogo ADI autorizzato.

## Vincoli rispettati

- Nessuna modifica a database, migration, RPC o dati.
- Nessuna chiamata a provider AI.
- Nessuna UI chat.
- Nessuna scrittura finanziaria.
- Nessun commit, push o deploy in questo sprint.

## Verifiche

- `git status`: working tree con sole modifiche dello Sprint 29.
- `npx tsc --noEmit`: verde.
- `npx vitest run` / `npm run test:run`: verde, 100 test file passed, 1 skipped; 1409 test passed, 14 skipped.
- `npm run test:coverage`: verde.
  - Statements: 86.41%.
  - Branches: 78.22%.
  - Functions: 89.75%.
  - Lines: 88.63%.
- `npm run build`: verde.
- `git diff --check`: verde; solo warning CRLF/LF su file testuali.
- `npm run lint`: tentato, ma lo script legacy `next lint` fallisce con Next 16 cercando la directory `lint`. Nessuna correzione applicata perché non collegata al nuovo codice.

## Test creati

- `tests/unit/financial-assistant/policies.test.ts`
  - feature flag fail-closed;
  - accesso private finance;
  - registry read-only;
  - validazione strict;
  - blocco scritture/prompt injection.
- `tests/unit/financial-assistant/orchestrator.test.ts`
  - riepilogo personale con evidence/citations;
  - blocco Aurora per account non autorizzato;
  - NEEDS_INPUT per affordability incompleta;
  - assenza di metodi Supabase di scrittura.
- `tests/api/financial-assistant-route.test.ts`
  - autenticazione capabilities;
  - occultamento strumenti privati;
  - flag disattivata;
  - payload strict.

## Limiti residui

- Nessuna UI chat implementata per vincolo di sprint.
- Nessun provider AI collegato per vincolo di sprint.
- Gli adapter affordability e decision comparison ritornano `NEEDS_INPUT` se mancano parametri essenziali e non salvano scenari.
- Il rate limiter è in memoria e sufficiente come fondazione locale; per ambienti multi-instance servirà store condiviso.
