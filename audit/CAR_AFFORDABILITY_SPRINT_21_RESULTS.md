# Sprint 21 — "Posso permettermi questa auto?" — Risultati

**Data**: 2026-07-28
**Sprint**: 21 — Car Affordability Engine
**Stato**: Completato

---

## 1. Obiettivo

Estendere la funzionalità "Posso permettermelo?" (Sprint 20) con una modalità specializzata per la valutazione dell'acquisto di un'automobile, incluso il calcolo del Total Cost of Ownership (TCO), costo per km, confronto auto A/B e confronto modalità di pagamento.

---

## 2. Principi rispettati

| Principio | Rispettato |
|---|---|
| Nessun commit / push / deploy | ✓ |
| Nessuna modifica ai dati finanziari reali | ✓ |
| Nessuna creazione di transazioni | ✓ |
| Nessuna modifica ai saldi | ✓ |
| Calcolo deterministico (no AI, no casualità) | ✓ |
| Nessuna API esterna | ✓ |
| Nessun recupero prezzi auto, carburante o assicurazioni online | ✓ |
| Nessuna snapshot di financial health | ✓ |
| Nessuna notifica generata | ✓ |
| Calcolo efimero (nessuna scrittura DB) | ✓ |

---

## 3. File creati

### Libreria car affordability

| File | Responsabilità |
|---|---|
| `src/lib/affordability/car/types.ts` | Tutti i tipi TypeScript (CarInput, CarCosts, CarMetrics, CarAffordabilityResult, ecc.) |
| `src/lib/affordability/car/constants.ts` | Costanti, etichette italiane per fuel type, condition, payment mode |
| `src/lib/affordability/car/validation.ts` | Schema Zod v4 per la validazione di CarInput (con nested strict objects) |
| `src/lib/affordability/car/costs.ts` | Calcolo TCO e tutti i costi (computeCarCosts) |
| `src/lib/affordability/car/explanations.ts` | Ragioni, rischi e alternative specifici per auto in italiano |
| `src/lib/affordability/car/comparison.ts` | Confronto modalità pagamento e confronto auto A vs. B |
| `src/lib/affordability/car/engine.ts` | Orchestratore principale (runCarAffordabilityEngine) |

### API

| File | Responsabilità |
|---|---|
| `src/app/api/affordability/car/calculate/route.ts` | POST endpoint dedicato alla valutazione auto |

### UI

| File | Responsabilità |
|---|---|
| `src/app/(app)/affordability/CarEvaluation.tsx` | Componente self-contained 'use client' con form progressivo e risultati |

### Test

| File | Test coperti |
|---|---|
| `tests/unit/affordability/car/costs.test.ts` | 25 test — TCO, riduzioni, running costs, missingCosts |
| `tests/unit/affordability/car/validation.test.ts` | 21 test — schema Zod v4, nested objects, superRefine |
| `tests/unit/affordability/car/engine.test.ts` | 13 test — result shape, classificazione, confronti, mutazioni |

---

## 4. File modificati

| File | Modifica |
|---|---|
| `src/app/(app)/affordability/page.tsx` | Aggiunto selettore tipo (Acquisto generico / Auto) e rendering condizionale CarEvaluation |
| `docs/USER_GUIDE.md` | Aggiunta sezione 29 "Valutazione auto" |
| `docs/PRODUCTION_CHECKLIST.md` | Aggiunta sezione 21 checklist car affordability |

---

## 5. Architettura del calcolo

```
POST /api/affordability/car/calculate
  → Auth check (401 se non autenticato)
  → Validazione CarInput (422 se non valido)
  → Verifica ownership account (404 se non trovato)
  → Caricamento dati in parallelo (7 query Supabase)
  → runCarAffordabilityEngine(input, dbData, now)
      → computeCarCosts()               — TCO completo
      → toAffordabilityInput()          — adapter CarInput → AffordabilityInput
      → runAffordabilityEngine()        — engine generico Sprint 20
      → buildAffordabilityBaseline()    — baseline finanziario
      → buildCarMetrics()               — metriche specifiche auto
      → buildCarReasons/Risks/Alternatives()
      → buildPaymentComparison()        — immediato vs. finanziamento (se FINANCING)
      → buildCarComparison()            — auto A vs. B (se compareWithCar presente)
  → { data: CarAffordabilityResult } (nessuna scrittura DB)
```

---

## 6. Formule TCO

### IMMEDIATE
```
effectivePurchasePrice = max(0, purchasePrice - totalReductions)
upfrontCarCost = effectivePurchasePrice + initialCostsSum
totalOwnershipCost = effectivePurchasePrice + initialCostsSum + totalAnnualRunningCost × ownershipYears
netOwnershipCost = totalOwnershipCost - estimatedResidualValue
averageMonthlyOwnershipCost = netOwnershipCost / ownershipPeriodMonths
costPerKilometer = netOwnershipCost / (annualKm × ownershipYears)
```

### FINANCING
```
upfrontCarCost = downPayment + initialCostsSum + financingFees
financedAmount = effectivePurchasePrice - downPayment
financingTotalCost = max(0, downPayment + installments×N + balloon + fees - effectivePurchasePrice)
totalOwnershipCost = downPayment + financingFees + initialCostsSum + installments×N + balloon + totalAnnualRunning × years
```

---

## 7. Costi running inclusi

| Voce | Modalità calcolo |
|---|---|
| Assicurazione | rcAnnual + theftFireAnnual + kaskoAnnual + other |
| Bollo auto | Media periodo (rispettando anni di esenzione) |
| Carburante / Energia | Stima mensile × 12 OPPURE km/100 × consumo × prezzo |
| Manutenzione | Ordinaria + straordinaria + tagliando + ammortizzato (revisione, gomme, batteria) |
| Altri costi | Parcheggio + pedaggi + lavaggi + soccorso stradale + altro |

---

## 8. Sezioni del form CarEvaluation

1. Veicolo (nome, prezzo, condizione, alimentazione, km/anno, anni utilizzo, data)
2. Riduzioni prezzo (sconto, incentivo, sussidio, permuta, vendita auto attuale)
3. Modalità di pagamento (immediato / finanziamento con rata, numero rate, anticipo)
4. Spese iniziali (immatricolazione, consegna, accessori, wallbox per EV)
5. Assicurazione (RC, furto/incendio, kasko)
6. Bollo auto (con supporto esenzione anni)
7. Carburante / Energia (stima mensile o calcolo da utilizzo)
8. Manutenzione (ordinaria, revisione, gomme con intervalli)
9. Altri costi ricorrenti (parcheggio, pedaggi, soccorso stradale)
10. Auto attuale (per confronto incrementale)
11. Valore residuo stimato
12. Preferenze (orizzonte, buffer liquidità, obiettivi)

---

## 9. Risultati TypeScript

```
npx tsc --noEmit → 0 errori
```

---

## 10. Risultati test

```
tests/unit/affordability/car/costs.test.ts      → 25/25 ✓
tests/unit/affordability/car/validation.test.ts  → 21/21 ✓
tests/unit/affordability/car/engine.test.ts      → 13/13 ✓
────────────────────────────────────────────────
Total nuovi (Sprint 21)                          → 59/59 ✓

Full suite                                       → 1049 passed, 14 skipped, 0 failed (65 test files)
```

---

## 11. Risultati build

```
npm run build → exit code 0
/affordability            → prerendered as static (○)
/api/affordability/calculate     → API route (ƒ)
/api/affordability/car/calculate → API route (ƒ)
```

---

## 12. Sicurezza

- Autenticazione obbligatoria via `supabase.auth.getUser()` (401 se assente)
- Verifica ownership account (404 se il conto non appartiene all'utente)
- Nessun dato scritto nel database
- Validazione input con Zod v4 (422 se non valido)
- Cache-Control: no-store sull'API response
- Nessuna introduzione di AI, API esterne, prezzi recuperati online

---

## 13. Limitazioni documentate

1. **Prezzi carburante/assicurazione**: non vengono recuperati automaticamente online — l'utente deve inserirli manualmente.
2. **Valore residuo**: stima manuale — non si interfaccia con servizi di valutazione auto.
3. **Confronto A vs. B**: il secondo veicolo usa un input semplificato (non ha tutte le sezioni del veicolo principale).
4. **Multi-valuta**: il motore utilizza EUR come valuta unica — non converte valute.

---

## 14. Reuso infrastruttura Sprint 20

- `runAffordabilityEngine` — engine generico (via adapter pattern)
- `buildAffordabilityBaseline` — baseline finanziario
- `CLASSIFICATION_LABELS`, `DISCLAIMER`, `SIMULATION_NOTE` — costanti
- `roundMoney`, `sumMoney` — utility monetarie

---

*Simulazione temporanea — nessun dato finanziario è stato modificato.*
