# Sprint 23 - Travel Affordability

## Executive Summary

Implementato il consulente deterministico "Posso permettermi questa vacanza?" per Aurora 5.1. Il profilo `TRAVEL_PURCHASE` riusa baseline, classificazione, soglie e motore affordability esistenti. Nessun dato reale viene modificato.

## Architettura

Creato `src/lib/affordability/travel/` con:

- `types.ts`
- `constants.ts`
- `validation.ts`
- `costs.ts`
- `schedule.ts`
- `projections.ts`
- `comparison.ts`
- `explanations.ts`
- `alternatives.ts`
- `engine.ts`

## Metriche

Il motore calcola:

- durata viaggio;
- notti;
- totale trasporti;
- totale alloggio;
- totale pasti;
- totale attività;
- totale extra;
- costo totale vacanza;
- pagamenti distribuiti;
- accantonamento mensile suggerito;
- liquidità residua;
- mesi copertura;
- saldo minimo previsto;
- mesi critici;
- budget massimo prudenziale.

## API

Creata:

- `POST /api/affordability/travel/calculate`

La route richiede autenticazione, valida con Zod strict, usa rate limit in memoria, carica solo baseline dell'utente e non scrive nel database.

## UI

Creata:

- `src/app/(app)/affordability/TravelEvaluation.tsx`

La pagina `/affordability` ora mostra: Acquisto generico, Auto, Casa, Vacanza.

## Test

Aggiunti:

- `tests/unit/affordability/travel/costs.test.ts`
- `tests/unit/affordability/travel/validation.test.ts`
- `tests/unit/affordability/travel/engine.test.ts`
- `tests/api/affordability-travel-route.test.ts`

## Documentazione

Aggiornati:

- `docs/USER_GUIDE.md`
- `docs/PRODUCTION_CHECKLIST.md`

## Verifiche

Eseguite il 2026-07-28:

- `git status --short`: worktree modificato con Sprint 22 e Sprint 23 non committati.
- `npx tsc --noEmit`: passato, 0 errori.
- `npx vitest run`: passato, 73 file passati, 1 skipped, 1109 test passati, 14 skipped, 0 failed.
- `npm run build`: passato, build Next.js production exit 0.
- `npm run test:coverage`: passato, 73 file passati, 1 skipped, 1110 test passati, 14 skipped, 0 failed.
- Coverage globale: statements 85.96%, branches 78.43%, functions 90.63%, lines 88.16%.
- Coverage `src/lib/affordability/travel`: statements 96.33%, branches 84.13%, functions 94.44%, lines 99.35%.
- `git diff --check`: passato. Sono presenti solo warning CRLF/LF di Windows, nessun errore whitespace.
- `npm audit`: non completato. Primo tentativo fallito su endpoint npm; rilancio con rete esterna rifiutato dal sistema per rischio di invio metadata dipendenze al registry npm.

## File creati

- `audit/TRAVEL_AFFORDABILITY_SPRINT_23_RESULTS.md`
- `src/app/(app)/affordability/TravelEvaluation.tsx`
- `src/app/api/affordability/travel/calculate/route.ts`
- `src/lib/affordability/travel/alternatives.ts`
- `src/lib/affordability/travel/comparison.ts`
- `src/lib/affordability/travel/constants.ts`
- `src/lib/affordability/travel/costs.ts`
- `src/lib/affordability/travel/engine.ts`
- `src/lib/affordability/travel/explanations.ts`
- `src/lib/affordability/travel/projections.ts`
- `src/lib/affordability/travel/schedule.ts`
- `src/lib/affordability/travel/types.ts`
- `src/lib/affordability/travel/validation.ts`
- `tests/api/affordability-travel-route.test.ts`
- `tests/unit/affordability/travel/costs.test.ts`
- `tests/unit/affordability/travel/engine.test.ts`
- `tests/unit/affordability/travel/validation.test.ts`

## File modificati

- `docs/PRODUCTION_CHECKLIST.md`
- `docs/USER_GUIDE.md`
- `src/app/(app)/affordability/page.tsx`
- `src/lib/affordability/types.ts`
- `vitest.config.ts`

## Limiti

- Nessuna stima turistica, fiscale o valutaria automatica.
- Nessuna AI.
- Nessuna API esterna.
- Nessun motore di prenotazione.
- Nessuna modifica a transazioni, saldi, notifiche o dati reali.
- Nessun test manuale browser mobile/dark mode/screen reader eseguito in questa sessione.
- `npm audit` non verificato per blocco sicurezza rete.
