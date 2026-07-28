# Sprint 22 - Home Affordability

## Stato iniziale

Aurora disponeva gia di un motore affordability generico, profilo auto, baseline read-only, classificazione deterministica, proiezioni e API dedicate. Non esisteva una tipologia specializzata per la casa.

## Architettura

Implementato il profilo `HOME_PURCHASE` come adapter specializzato sopra il motore esistente:

- `src/lib/affordability/home/types.ts`
- `src/lib/affordability/home/constants.ts`
- `src/lib/affordability/home/validation.ts`
- `src/lib/affordability/home/costs.ts`
- `src/lib/affordability/home/mortgage.ts`
- `src/lib/affordability/home/ownership-cost.ts`
- `src/lib/affordability/home/projections.ts`
- `src/lib/affordability/home/explanations.ts`
- `src/lib/affordability/home/alternatives.ts`
- `src/lib/affordability/home/comparison.ts`
- `src/lib/affordability/home/engine.ts`

Il motore casa riusa baseline, classificazione, metriche, proiezione, soglie e disclaimer del motore affordability.

## Profilo casa

La UI aggiunge la scelta "Casa" accanto ad "Acquisto generico" e "Auto". Le etichette mostrate all'utente sono italiane.

## Prezzo effettivo

Formula:

`prezzo effettivo = prezzo concordato - sconto - contributo familiare - agevolazione manuale - ricavo vendita immobile - altro contributo`

La caparra gia versata non riduce il costo totale: e trattata come quota gia sostenuta o parte dell'anticipo.

## Mutuo

Il mutuo considera importo, anticipo, rata, durata, prima rata, tipo tasso come etichetta, TAN/TAEG opzionali e costi manuali: istruttoria, perizia, assicurazione obbligatoria, incasso rata, preammortamento e maxi-rata.

Aurora non recupera tassi online e non calcola TAN o TAEG.

## Costi iniziali

Sono inclusi notaio, imposte, agenzia, perizia, istruttoria, assicurazione iniziale, mediazione, registrazioni, certificazioni, spese tecniche, trasloco, allacci, depositi e altri costi.

## Ristrutturazione

I lavori sono manuali: totale stimato, quota gia pagata, durata, rate, imprevisti, margine prudenziale e lavori futuri.

## Arredamento

Sono distinti arredamento totale e arredamento rinviabile. Le alternative possono suggerire di rinviare solo la quota dichiarata rinviabile.

## Condominio, utenze, assicurazione, imposte, manutenzione

Il motore calcola costi annuali, medi mensili e impatto sul costo abitativo totale. Nessun valore viene inventato.

## Abitazione attuale

Il profilo casa calcola l'incremento reale mensile rispetto ad affitto, mutuo attuale o costi abitativi correnti.

## Affitto vs acquisto

Il confronto e rappresentato tramite incremento mensile, costo totale, liquidita, valore residuo e rischi. Aurora non dichiara che acquistare sia sempre migliore dell'affitto.

## Valore residuo e debito residuo

Valore dell'immobile, debito residuo, costi di vendita e imposte/commissioni sono stime inserite dall'utente. La liquidita resta valutata separatamente dal patrimonio teorico.

## Proiezioni

Le proiezioni usano il motore generico e includono esborso iniziale, rata, costi ricorrenti, maxi-rata e costo medio gestionale. I costi annuali sono trattati come input manuali e non come dati reali.

## Classificazione

La classificazione continua a usare liquidita residua, mesi di copertura, margine mensile, mesi negativi, liquidita minima prevista, qualita dati e soglie di prudenza. Il profilo casa aggiunge ragioni e rischi specifici.

## Alternative

Alternative deterministiche implementate:

- riduzione esborso iniziale;
- rinvio arredamento non essenziale;
- distribuzione lavori;
- riduzione rata/prezzo se la rata pesa troppo;
- attesa 6/12/24 mesi;
- confronto con abitazione attuale.

## Confronto

Il motore supporta confronto opzionale tra due case e confronto tra opzioni mutuo senza dichiarare una scelta assoluta migliore.

## Prezzo massimo

Il prezzo massimo compatibile e prudenziale e viene nascosto se la baseline o i costi sono troppo incompleti.

## Costi mancanti e qualita dati

Il motore segnala notaio, imposte, agenzia, lavori, arredamento, condominio, utenze, assicurazione, imposte ricorrenti, manutenzione, valore residuo e debito residuo mancanti.

## Precisione

Tutti gli importi passano dalle utility monetarie Aurora `roundMoney` e `sumMoney`.

## Date e valute

Le date sono ISO `YYYY-MM-DD`. La route verifica ownership dei conti e valuta EUR per i conti indicati.

## Sicurezza, ownership e privacy

La route `POST /api/affordability/home/calculate`:

- richiede autenticazione;
- valida con Zod strict;
- ignora user id dal client;
- verifica ownership dei conti;
- applica rate limit in memoria;
- non scrive nel database;
- non usa service role;
- non logga prezzi, indirizzi o redditi.

## UI, responsive e accessibilita

La UI usa sezioni progressive, label associate, `aria-expanded`, `aria-live` nel risultato, touch target adeguati e card responsive. Non sono stati eseguiti test manuali browser a 320/360/390/430 px.

## Test

Aggiunti:

- `tests/unit/affordability/home/costs.test.ts`
- `tests/unit/affordability/home/validation.test.ts`
- `tests/unit/affordability/home/engine.test.ts`
- `tests/api/affordability-home-route.test.ts`

Coprono costi, mutuo, caparra, contributi, costi iniziali, lavori, arredamento, ricorrenti, abitazione attuale, valore residuo, validazione, engine, alternative, confronti, API, ownership, rate limit e assenza di mutazioni.

## Verifiche

Eseguite il 2026-07-28:

- `git status --short`: worktree modificato con file Sprint 22 non committati.
- `npx tsc --noEmit`: passato, 0 errori.
- `npx vitest run`: passato, 69 file passati, 1 skipped, 1091 test passati, 14 skipped, 0 failed.
- `npm run test:coverage`: passato, 69 file passati, 1 skipped, 1091 test passati, 14 skipped, 0 failed.
- Coverage globale: statements 85.22%, branches 78.02%, functions 90.41%, lines 87.36%.
- Coverage `src/lib/affordability/home`: statements 99.36%, branches 92.59%, functions 100%, lines 100%.
- Coverage `src/lib/affordability/home/costs.ts`: statements 100%, branches 96.8%, functions 100%, lines 100%.
- Coverage `src/lib/affordability/home/validation.ts`: statements 100%, branches 96.42%, functions 100%, lines 100%.
- `npm run build`: passato, build Next.js production exit 0.
- `git diff --check`: passato. Sono presenti solo warning CRLF/LF di Windows, nessun errore whitespace.
- `npm audit`: non completato. Primo tentativo fallito su endpoint npm; rilancio con rete esterna rifiutato dal sistema per rischio di invio metadata dipendenze al registry npm.
- `npm run lint`: eseguito perche lo script esiste, ma fallisce con `Invalid project directory provided ... Aurora-5.0\lint`; lo script usa `next lint`, non compatibile con il comportamento Next 16 rilevato.

## File creati

- `audit/HOME_AFFORDABILITY_SPRINT_22_RESULTS.md`
- `src/app/(app)/affordability/HomeEvaluation.tsx`
- `src/app/api/affordability/home/calculate/route.ts`
- `src/lib/affordability/home/alternatives.ts`
- `src/lib/affordability/home/comparison.ts`
- `src/lib/affordability/home/constants.ts`
- `src/lib/affordability/home/costs.ts`
- `src/lib/affordability/home/engine.ts`
- `src/lib/affordability/home/explanations.ts`
- `src/lib/affordability/home/mortgage.ts`
- `src/lib/affordability/home/ownership-cost.ts`
- `src/lib/affordability/home/projections.ts`
- `src/lib/affordability/home/types.ts`
- `src/lib/affordability/home/validation.ts`
- `tests/api/affordability-home-route.test.ts`
- `tests/unit/affordability/home/costs.test.ts`
- `tests/unit/affordability/home/engine.test.ts`
- `tests/unit/affordability/home/mortgage-projection.test.ts`
- `tests/unit/affordability/home/validation.test.ts`

## File modificati

- `docs/PRODUCTION_CHECKLIST.md`
- `docs/USER_GUIDE.md`
- `src/app/(app)/affordability/page.tsx`
- `src/lib/affordability/types.ts`
- `vitest.config.ts`

## Limiti e rischi residui

- Non viene applicata alcuna migration.
- Nessuna stima normativa/fiscale automatica.
- Nessun recupero tassi o prezzi online.
- Le proiezioni restano scenari informativi, non previsioni certe.
- Il confronto affitto/acquisto usa solo dati inseriti dall'utente.
- Test manuali browser per 320/360/390/430 px, zoom 200%, screen reader e dark mode non eseguiti in questa sessione.
- `npm audit` non verificato per blocco di sicurezza rete.
- `npm run lint` non utilizzabile finche lo script resta `next lint` con Next 16.

## Conclusione

Sprint 22 introduce la valutazione "Posso permettermi questa casa?" in modo deterministico, read-only e coerente con il motore affordability esistente.
