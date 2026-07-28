# Sprint 20 — "Posso permettermelo?" — Risultati

**Data**: 2026-07-28
**Sprint**: 20 — Affordability Engine
**Stato**: Completato

---

## 1. Obiettivo

Implementare la funzionalità "Posso permettermelo?" che consente agli utenti di simulare la sostenibilità di un acquisto in base ai propri dati finanziari registrati in Aurora.

---

## 2. Principi rispettati

| Principio | Rispettato |
|---|---|
| Nessuna modifica ai dati finanziari reali | ✓ |
| Nessuna creazione di transazioni | ✓ |
| Nessuna modifica ai saldi | ✓ |
| Calcolo deterministico (no AI, no casualità) | ✓ |
| Nessuna API esterna | ✓ |
| Nessun cron o job in background | ✓ |
| Nessuna snapshot di financial health | ✓ |
| Nessuna notifica generata | ✓ |
| Calcolo efimero (nessuna scrittura DB) | ✓ |
| Autenticazione richiesta | ✓ |

---

## 3. File creati

### Libreria affordability

| File | Responsabilità |
|---|---|
| `src/lib/affordability/types.ts` | Tutti i tipi TypeScript dell'engine |
| `src/lib/affordability/constants.ts` | Costanti, soglie, etichette italiane |
| `src/lib/affordability/validation.ts` | Schema Zod per la validazione dell'input |
| `src/lib/affordability/baseline.ts` | Calcolo del baseline finanziario |
| `src/lib/affordability/metrics.ts` | Metriche derivate (liquidità, margine, proiezione) |
| `src/lib/affordability/classification.ts` | Classificazione e punteggio di sostenibilità |
| `src/lib/affordability/explanations.ts` | Ragioni e rischi in italiano |
| `src/lib/affordability/alternatives.ts` | Alternative deterministiche |
| `src/lib/affordability/engine.ts` | Orchestratore principale |

### API

| File | Responsabilità |
|---|---|
| `src/app/api/affordability/calculate/route.ts` | POST endpoint — carica dati, chiama engine, restituisce risultato |

### UI

| File | Responsabilità |
|---|---|
| `src/app/(app)/affordability/page.tsx` | Pagina client con form e visualizzazione risultati |

### Test

| File | Test coperti |
|---|---|
| `tests/unit/affordability/validation.test.ts` | 35 test — schema Zod, validazione input |
| `tests/unit/affordability/classification.test.ts` | 27 test — classificazione, score, label |
| `tests/unit/affordability/engine.test.ts` | 51 test — engine completo, nessuna mutazione |

---

## 4. File modificati

| File | Modifica |
|---|---|
| `src/app/(app)/layout.tsx` | Aggiunto link "Permettermelo?" in sidebar e menu "Altro" |
| `src/components/global-command-menu.tsx` | Aggiunta voce navigazione e azione rapida |
| `src/lib/affordability/validation.ts` | Fix sintassi Zod v4 (da v3 a v4 API) |
| `src/lib/affordability/explanations.ts` | Fix funzione `fmt` duplicata |
| `docs/USER_GUIDE.md` | Aggiunta sezione 28 "Posso permettermelo?" |
| `docs/PRODUCTION_CHECKLIST.md` | Aggiunta sezione 20 checklist affordability |

---

## 5. Architettura del calcolo

```
POST /api/affordability/calculate
  → Auth check (401 se non autenticato)
  → Validazione input (422 se non valido)
  → Verifica ownership account (404 se non trovato)
  → Caricamento dati in parallelo (7 query Supabase)
  → runAffordabilityEngine(input, dbData, now)
      → buildAffordabilityBaseline()  — media ultimi 3 mesi
      → computeCostBreakdown()        — costi immediati e rateali
      → compute{Liquidity,Coverage,Margin,Ratios}()
      → buildProjection()             — 12 mesi (configurabile)
      → classify()                    — soglie deterministiche
      → computeSustainabilityScore()  — 0-100
      → buildReasons() + buildRisks()
      → buildAlternatives()
      → computeMaxAffordablePrice()
  → { data: AffordabilityResult } (nessuna scrittura DB)
```

---

## 6. Classificazioni

| Classificazione | Italiano | Condizione principale |
|---|---|---|
| `AFFORDABLE` | Sostenibile | Tutti gli indicatori OK |
| `CAUTION` | Sostenibile con cautela | Almeno un indicatore vicino alla soglia |
| `RISKY` | Rischioso | Almeno un indicatore supera la soglia |
| `NOT_AFFORDABLE` | Non sostenibile | Liquidità negativa o margine profondamente negativo |
| `INSUFFICIENT_DATA` | Dati insufficienti | Nessun conto attivo e nessuna entrata |

---

## 7. Soglie di classificazione

| Metrica | AFFORDABLE | CAUTION | RISKY | NOT_AFFORDABLE |
|---|---|---|---|---|
| Rata / margine | ≤ 35% | 35%–50% | 50%–70% | > 70% |
| Mesi negativi | 0 | 1 | ≥ 3 | ≥ 6 |
| Liquidità dopo | ≥ buffer | < buffer | < 50% buffer | < 0 |

Buffer default: 3 mesi di spese (configurabile 0–24).

---

## 8. Qualità dei dati

| Qualità | Condizione | Score |
|---|---|---|
| ALTA | ≥ 6 mesi di transazioni | 90 |
| MEDIA | ≥ 2 mesi di transazioni | 65 |
| BASSA | ≥ 1 mese o ricorrenze attive | 30 |
| INSUFFICIENTE | Nessun dato | 0–5 |

Nota: con LOOKBACK_MONTHS=3, la qualità massima ottenibile via transazioni è MEDIA (3 mesi < 6 necessari per ALTA). Questo è un limite documentato del motore v1.

---

## 9. Modalità di pagamento supportate

### Immediata
- Prezzo totale pagato in un'unica soluzione
- Calcola liquidità residua, mesi di copertura
- Max prezzo compatibile calcolato in base al buffer minimo

### Rateale
- Anticipo + rata mensile × n rate + eventuale maxi-rata finale
- Calcola ratio rata/margine
- Max prezzo = anticipo massimo + max finanziabile

---

## 10. Reuso dell'infrastruttura esistente

Le seguenti funzioni di `src/lib/scenarios/` sono riusate senza duplicazione:

- `roundMoney`, `addMoney`, `subtractMoney`, `sumMoney`, `averageMoney` — da `money.ts`
- `generatePeriods`, `periodKeyForDate`, `currentMonthStart` — da `dates.ts`

---

## 11. Risultati TypeScript

```
npx tsc --noEmit → 0 errori
```

Correzione applicata: `validation.ts` usava API Zod v3 (`required_error`, `invalid_type_error`, `errorMap`). Aggiornato a Zod v4 (`error`, `message`, parametro stringa per `z.enum`).

---

## 12. Risultati test

```
tests/unit/affordability/validation.test.ts   → 35/35 ✓
tests/unit/affordability/classification.test.ts → 27/27 ✓
tests/unit/affordability/engine.test.ts        → 51/51 ✓
─────────────────────────────────────────────
Total affordability                            → 113/113 ✓

Full suite: 990 passed, 14 skipped, 0 failed (62 test files)
```

---

## 13. Risultati build

```
npm run build → exit code 0
/affordability → prerendered as static (○)
/api/affordability/calculate → API route included
```

---

## 14. Sicurezza

- Autenticazione obbligatoria via `supabase.auth.getUser()` (401 se assente)
- Verifica ownership account (404 se il conto non appartiene all'utente)
- Nessun dato scritto nel database
- Validazione input con Zod (422 se non valido)
- Cache-Control: no-store sull'API response
- Nessuna introduzione di AI, API esterne o cron

---

## 15. Limitazioni documentate

1. **Qualità dati**: con finestra 3 mesi, la qualità ALTA (≥6 mesi) non è attualmente raggiungibile via transazioni. Previsto come miglioramento futuro ampliando la finestra o aggiungendo sorgenti dati.
2. **Multi-valuta**: il motore somma i saldi di tutti i conti attivi senza conversione valutaria. Se l'utente ha conti in valute diverse, la stima potrebbe non essere accurata. Documentato in `missingData`.
3. **Scenari multipli**: il campo `comparison` nell'output è sempre `null` (previsto come miglioramento futuro usando la tabella `financial_scenarios` esistente).

---

## 16. Voci di navigazione aggiunte

- Sidebar desktop: "Permettermelo?" con icona `ShoppingCart` (lucide-react)
- Menu mobile "Altro": stessa voce
- Command menu (Ctrl+K): voce navigazione + azione rapida con keywords italiane

---

*Simulazione temporanea — nessun dato finanziario è stato modificato.*
