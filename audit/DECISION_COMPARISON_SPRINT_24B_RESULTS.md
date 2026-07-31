# Sprint 24B — Decision Comparison UI + API — Risultati

## Obiettivo

Integrare il Decision Comparison Engine (Sprint 24A, `src/lib/decision-comparison/`) nell'applicazione tramite una route API server-side e una pagina di confronto, senza modificare il core esistente.

## Origine degli scenari

Nessuno dei 4 calcolatori affordability (generico, auto, casa, vacanza) persiste risultati: sono calcolatori client-side "calcola e mostra". Gli adapter di Sprint 24A (`adaptGenericScenario`/`adaptCarScenario`/`adaptHomeScenario`/`adaptTravelScenario`) si aspettano infatti l'**input grezzo di dominio + i dati finanziari dell'utente**, non un risultato precalcolato.

Di conseguenza la route riceve per ogni scenario `{ id, domain, label?, input }`, dove `input` è lo stesso schema Zod già usato dalle route `/api/affordability/{car,home,travel}/calculate` (o generico). La route recupera i dati finanziari dell'utente una sola volta per richiesta e invoca gli adapter esistenti: nessun numero calcolato arriva mai dal client.

**Limite noto:** nessun risultato del confronto viene salvato — uscendo dalla pagina, il confronto va ripetuto. Non è stata introdotta alcuna nuova tabella Supabase.

## File creati

- `src/app/api/affordability/compare/route.ts` — route POST
- `src/app/api/affordability/compare/route.test.ts` — test API (22 casi)
- `src/app/(app)/affordability/compare/page.tsx` — pagina di confronto
- `src/app/(app)/affordability/compare/types.ts` — logica pura (selezione scenari, validazione, costruzione payload)
- `src/app/(app)/affordability/compare/types.test.ts` — test della logica pura (23 casi)
- `src/app/(app)/affordability/compare/format.ts` — formattatori e testi profili/criteri
- `src/app/(app)/affordability/compare/ScenarioSelector.tsx`
- `src/app/(app)/affordability/compare/ScenarioForm.tsx`
- `src/app/(app)/affordability/compare/DecisionProfileSelector.tsx`
- `src/app/(app)/affordability/compare/CustomWeightsEditor.tsx`
- `src/app/(app)/affordability/compare/ComparisonLoadingState.tsx`
- `src/app/(app)/affordability/compare/ComparisonErrorState.tsx`
- `src/app/(app)/affordability/compare/ComparisonSummary.tsx`
- `src/app/(app)/affordability/compare/ComparisonRanking.tsx`
- `src/app/(app)/affordability/compare/ComparisonCriteriaBreakdown.tsx`
- `src/app/(app)/affordability/compare/ComparisonTradeoffs.tsx`
- `src/app/(app)/affordability/compare/ComparisonWarnings.tsx`
- `src/app/(app)/affordability/compare/ComparisonMethodology.tsx`

## File modificati

- `src/app/(app)/affordability/page.tsx` — aggiunta CTA "Confronta scenari" verso `/affordability/compare`
- `docs/USER_GUIDE.md` — nuova sezione 33 "Confronta le tue decisioni"

## API — `POST /api/affordability/compare`

- Autenticazione tramite Supabase (`401 UNAUTHORIZED` se assente), stessa convenzione delle altre route affordability.
- Validazione integrale con Zod: 2-4 scenari, ID univoci, `domain` in `generic|car|home|travel` con lo schema di input reale del dominio (discriminated union), profilo tra i 7 valori del core, `customWeights` richiesti solo per `CUSTOM`.
- Verifica ownership di `accountId`/`debitAccountId` su tutti gli scenari prima del calcolo (`404 ACCOUNT_NOT_FOUND`).
- Nessuna logica di scoring duplicata: la route invoca esclusivamente gli adapter e `compareDecisions` del core Sprint 24A.
- Errori con forma stabile `{ error: { code, message } }`, nessuno stack trace esposto.
- Mappatura codici → HTTP: `VALIDATION_ERROR`/`INVALID_WEIGHTS`/`TOO_FEW_SCENARIOS`/`TOO_MANY_SCENARIOS` → 400; `UNAUTHORIZED` → 401; `ACCOUNT_NOT_FOUND` → 404; `CURRENCY_MISMATCH`/`INVALID_NUMBER`/`INSUFFICIENT_DATA` → 422; `CALCULATION_FAILED` → 500; `METHOD_NOT_ALLOWED` → 405 su GET.

## UI — `/affordability/compare`

- Selezione di 2-4 scenari con form di inserimento rapido per dominio (campi minimi richiesti da ciascuno schema reale), blocco esplicito sotto 2 o sopra 4 scenari.
- Selettore di profilo con nome e descrizione per ciascuno dei 7 profili del core; editor pesi personalizzati per `CUSTOM` (nessuna normalizzazione silenziosa lato client: la normalizzazione proporzionale è demandata al core, come da contratto).
- Stati richiesta gestiti esplicitamente (idle/loading/success/error) con `aria-live`, pulsante disabilitato durante il caricamento, retry in caso di errore.
- Risultati: scenario migliore con testo prudente, classifica con indicazione di parità/dominanza, dettaglio criteri (tabella responsive su desktop, card su mobile), trade-off, avvisi di compatibilità/dati mancanti, sezione metodologia collassabile.

## Limite noto sui test UI

Il progetto non ha infrastruttura di test per componenti React (nessun jsdom/happy-dom, nessuna `@testing-library/react`; `vitest.config.ts` gira in `environment: 'node'` sui soli `*.test.ts`). Per non introdurre nuove dipendenze non strettamente necessarie, la logica della UI (selezione scenari, validazione pesi, costruzione payload, formattazione) è stata estratta in moduli `.ts` puri e testata direttamente (23 test in `types.test.ts`); il rendering React non è coperto da test automatici in questo sprint.

## Risultati verifiche finali

- TypeScript: **0 errori** (`npx tsc --noEmit`)
- Test progetto (`npx vitest run` / `npm run test:coverage`): **1354 passed**, 14 skipped (pre-esistenti), **0 failed** — baseline 1298 + 56 nuovi test Sprint 24B, nessuna regressione
- Test Sprint 24B: **56 passed** (25 route API + 23 logica pura UI + 8 formattazione)
- Coverage globale: Statements 87.77%, Branches 80.32%, Functions 92.02%, Lines 89.73% (soglie minime invariate: 80/70/80/80)
- Coverage nuovi file Sprint 24B:
  - `src/app/api/affordability/compare/route.ts`: 100% stmts / 87.5% branch / 100% funcs / 100% lines
  - `src/app/(app)/affordability/compare/types.ts` + `format.ts`: 100% stmts / 93.61% branch / 100% funcs / 100% lines
  - target (≥90/85/90/90) raggiunto su tutti gli assi per entrambi
  - i componenti `.tsx` (pagina e componenti UI) non sono coperti da test automatici — vedi limite sopra; questo è coerente con il resto del progetto, dove nessun file `.tsx` è mai stato tracciato in coverage
- Build (`npm run build`): **completata con successo**, route `/affordability/compare` (statica) e `/api/affordability/compare` (dinamica) registrate correttamente
- `git diff --check`: nessun errore (solo avvisi di normalizzazione EOL LF→CRLF, non bloccanti)

## Conferme

- Nessun commit, nessun push, nessun deploy.
- Nessuna migrazione Supabase, nessuna modifica a dati reali.
- Nessuna API esterna, nessuna AI introdotta.
