# Budget Sprint 7B — Risultati

## 1. File creati

| File | Tipo | Descrizione |
|------|------|-------------|
| `src/app/api/budgets/[id]/history/route.ts` | Nuovo | GET storico 12 mesi per budget |
| `src/app/(app)/budgets/[id]/page.tsx` | Nuovo | Pagina dettaglio budget con chart + transazioni |
| `tests/unit/budgets/service-7b.test.ts` | Nuovo | 64 test unitari per le nuove funzioni pure |

## 2. File modificati

| File | Modifica |
|------|----------|
| `src/lib/budgets/service.ts` | Riscrittura completa: +7 tipi, +8 funzioni pure, +2 funzioni DB |
| `src/app/api/budgets/[id]/route.ts` | Aggiunto handler GET (prima solo PUT/DELETE) |
| `src/app/api/budgets/route.ts` | Aggiunto supporto `?enriched=1` |
| `src/lib/dashboard/service.ts` | Import aggiornati, `DashboardPayload.budgetSummary` → `EnrichedBudgetSummary` |
| `src/app/(app)/budgets/page.tsx` | Riscrittura: dati arricchiti, forecast, confronto, alert, insight |
| `src/app/(app)/dashboard/page.tsx` | Card budget aggiornata con `projectedTotalOverrun` e `topProjectedRisks` |
| `tests/api/budgets-route.test.ts` | +2 suite: GET /api/budgets/[id] e GET /api/budgets/[id]/history |
| `tests/unit/dashboard/service.test.ts` | `emptyBudgetSummary` esteso con campi `EnrichedBudgetSummary` |

## 3. Funzioni service aggiunte (`src/lib/budgets/service.ts`)

### Tipi nuovi
- `BudgetForecast` — previsione fine mese per una categoria
- `BudgetComparison` — confronto spesa mese corrente vs precedente
- `BudgetAlert` — avviso soglia (50/75/90/100% + projected_overrun)
- `BudgetInsight` — insight automatico testuale
- `BudgetHistoryPoint` — punto mensile dello storico 12 mesi
- `EnrichedBudgetEntry` — `BudgetEntry` + forecast + comparison + topAlert
- `EnrichedBudgetSummary` — `BudgetSummary` + campi previsionali + alerts + insights
- `BudgetDetailPayload` — payload completo pagina dettaglio
- `BudgetDetailTransaction` — transazione per lista nella pagina dettaglio

### Funzioni pure
| Funzione | Firma sintetica | Scopo |
|----------|-----------------|-------|
| `buildBudgetForecast` | `(spent, amount, year, month, now) → BudgetForecast` | Previsione fine mese |
| `buildBudgetComparison` | `(currentSpent, prevSpent) → BudgetComparison` | Trend mensile |
| `buildBudgetAlerts` | `(entries, forecasts) → BudgetAlert[]` | Avvisi soglia, ordinati per priorità |
| `buildBudgetInsights` | `(entries, maxCount?) → BudgetInsight[]` | Insight mese corrente (max 5) |
| `buildBudgetHistoryInsights` | `(history, maxCount?) → BudgetInsight[]` | Insight storico 12 mesi |
| `computeBudgetHistory` | `(catId, childIds, pastBudgets, allTxs, now) → BudgetHistoryPoint[]` | 12 punti mensili |
| `computeEnrichedBudgetSummary` | `(base, entries, alerts, insights) → EnrichedBudgetSummary` | Sommario arricchito |

### Funzioni DB
| Funzione | Query | Scopo |
|----------|-------|-------|
| `listMonthlyBudgetsEnriched` | 3 query (budget+cat, tx mese corrente, tx mese precedente) | Lista budget con forecast/confronto |
| `getBudgetDetail` | 3 query bulk + 1 conti | Payload completo pagina dettaglio |
| `getBudgetHistory` | 2 query (budget corrente, tutti i budget+tx passati) | Solo storico (per endpoint /history) |

## 4. Endpoint creati o modificati

| Metodo | Path | Stato | Descrizione |
|--------|------|--------|-------------|
| `GET` | `/api/budgets?enriched=1` | Modificato | Restituisce `EnrichedBudgetEntry[]` + `alerts` + `insights` |
| `GET` | `/api/budgets/[id]` | Nuovo handler | Payload completo: budget + forecast + comparison + history + alerts + insights + transactions |
| `GET` | `/api/budgets/[id]/history` | Nuovo file | Storico 12 mesi + categoryName |

Tutti restituiscono `Cache-Control: no-store`.
UUID validato con regex prima dell'accesso DB su tutti i route `[id]`.

## 5. Formula previsione

```
daysInMonth  = ultimo giorno del mese (es: 31 per luglio)
daysElapsed  = oggi.getDate()         se mese corrente
             = daysInMonth            se mese passato
             = 0                      se mese futuro

hasEnoughData = daysElapsed >= 3 AND spent > 0

dailyAvg          = spent / daysElapsed           // non arrotondato (evita accumulo errore)
dailyAvgSpend     = round2(dailyAvg)              // solo per display
projectedSpent    = round2(dailyAvg * daysInMonth)
projectedOverrun  = max(0, projectedSpent - amount)
projectedRemaining = amount - projectedSpent
projectedPercentage = round(projectedSpent / amount * 100)
```

> **Nota implementativa**: `dailyAvgSpend` viene arrotondato per il display, ma la moltiplicazione per `projectedSpent` usa il valore grezzo per evitare errori di precisione floating-point (es: `round2(9.68) * 31 = 300.08` invece di 300).

## 6. Confronto mensile

```
absoluteDiff   = currentSpent - prevSpent
percentageDiff = prevSpent > 0 ? absoluteDiff / prevSpent * 100 : 0

trend:
  'unavailable'  → prevSpent = 0 AND currentSpent > 0  (nessuna baseline)
  'stable'       → |absoluteDiff / prevSpent| < 0.03   (variazione < 3%)
  'up'           → currentSpent > prevSpent (> 3%)
  'down'         → currentSpent < prevSpent (> 3%)
```

Soglia stabilità: **3%** di variazione relativa.

## 7. Storico budget (12 mesi)

Per ogni budget viene costruita una serie di 12 `BudgetHistoryPoint` mensili.

- **Fonte dati**: unica query bulk che scarica tutte le transazioni degli ultimi 12 mesi per l'account → nessuna query per mese.
- **Rollup categorie**: se la categoria ha figli, il conto include `categoryId IN [rootId, ...childIds]`.
- **Regole contabili**: solo `type='expense' AND transfer_peer_id IS NULL`.
- **Mesi senza budget**: `hadBudget = false`, tutti i campi a 0 — il punto esiste ma non viene considerato nelle analisi.
- **Crossing d'anno**: la serie copre sempre 12 mesi a ritroso dalla data corrente (es: agosto 2025 → luglio 2026).

Status per ogni punto:
```
percentage >= 100% → 'exceeded'
percentage >= 90%  → 'critical'
percentage >= 75%  → 'warning'
altrimenti         → 'safe'
```

## 8. Avvisi (BudgetAlert)

### Soglie reali (una sola per categoria, la più alta)
| Soglia | Tipo | Priorità |
|--------|------|----------|
| ≥ 100% | `exceeded` | 1 |
| ≥ 90%  | `critical` | 2 |
| ≥ 75%  | `warning` | 3 |
| ≥ 50%  | `at_risk` | 4 |

### Soglia previsionale
- `projected_overrun`: aggiunto solo se `hasEnoughData=true` AND `projectedOverrun > 0` AND la categoria non ha già superato il 100% reale.
- Priorità: 2 (tra exceeded e critical).

Gli alert sono ordinati per priorità crescente; una categoria genera al massimo 2 avvisi (1 reale + 1 previsionale).

## 9. Insight

### Insight mese corrente (`buildBudgetInsights`, max 3 in dashboard, max 5 in pagina budget)
| Tipo | Condizione | Priorità |
|------|-----------|----------|
| `projected_overrun` | forecast.projectedOverrun > 0 | 1 |
| `early_month_high_spend` | daysElapsed ≤ 10 AND percentage ≥ 50 | 2 |
| `budget_almost_exhausted` | 75 ≤ percentage < 100 | 3 |
| `spending_down` | comparison.trend = 'down' | 4 |
| `spending_up` | comparison.trend = 'up' | 5 |

### Insight storico (`buildBudgetHistoryInsights`, pagina dettaglio)
| Tipo | Condizione | Priorità |
|------|-----------|----------|
| `repeated_overrun` | ≥ 2 degli ultimi 6 mesi superati | 1 |
| `consistently_within_budget` | 3 mesi consecutivi recenti in 'safe' | 3 |
| `best_month_in_period` | mese con spesa minima (se ≥ 3 mesi con budget) | 4 |
| `worst_month_in_period` | mese con spesa massima (se diversa da minima) | 5 |

## 10. Integrazione dashboard

`src/lib/dashboard/service.ts` è stato aggiornato per:

1. Importare le nuove funzioni dal servizio budget.
2. Riutilizzare le `prevTxs` già caricate (nessuna query aggiuntiva).
3. Costruire `budgetEnriched: EnrichedBudgetEntry[]` da `budgetEntries` + forecast + comparisons.
4. Calcolare `budgetAlerts` e `budgetInsights` (max 3).
5. Restituire `budgetSummary: EnrichedBudgetSummary` invece di `BudgetSummary`.

La pagina dashboard mostra:
- Banner `projectedTotalOverrun` se il totale previsto supera il budget.
- Lista `topProjectedRisks` (max 3 categorie con maggiore sforamento atteso).

## 11. Query e ottimizzazioni

### `listMonthlyBudgetsEnriched` — 3 query totali
```
Q1: budgets JOIN categories (mese richiesto)
Q2: transactions (mese corrente, tipo expense, no transfer)
Q3: transactions (mese precedente, stessa clausola)
```
Q2 e Q3 vengono eseguite in parallelo (`Promise.all`).

### `getBudgetDetail` — 4 query totali
```
Q1: budget corrente + categoria + figli
Q2: conti dell'utente (per display)
Q3: tutti i budget passati della categoria (12 mesi)
Q4: transazioni bulk 12 mesi (unica query, poi filtrate in memoria per mese)
```
Le ultime due sono eseguite in parallelo (`Promise.all`).

### `getBudgetHistory` — 2 query totali
```
Q1: budget corrente + categoria + figli
Q2: budget + transazioni bulk 12 mesi (stesso pattern di getBudgetDetail)
```

**Nessuna query N+1**: tutte le categorie/mesi vengono elaborate in memoria dopo il caricamento bulk.

## 12. Test eseguiti

```
Test Files: 21 passed | 1 skipped (22 total)
Tests:     392 passed | 14 skipped (406 total)   [erano 317]
```

### Nuovi test Sprint 7B
- **`tests/unit/budgets/service-7b.test.ts`** — 64 test:
  - `buildBudgetForecast`: 10 test (hasEnoughData, mesi 28/29/30/31, mese passato/futuro, divisione per zero, giorno 1/ultimo)
  - `buildBudgetComparison`: 5 test (tutti i 4 trend, soglia 3%)
  - `buildBudgetAlerts`: 7 test (tutte le soglie, projected_overrun, priorità)
  - `buildBudgetInsights`: 6 test (max count, tipi, no contraddizioni)
  - `computeBudgetHistory`: 7 test (12 punti, crossing anno, figli categoria, status)
  - `buildBudgetHistoryInsights`: 6 test (repeated_overrun, consistently_within_budget, best/worst, max 5)
  - `computeEnrichedBudgetSummary`: 5 test (projectedTotalSpent, topProjectedRisks max 3, campi base preservati)
- **`tests/api/budgets-route.test.ts`** — +11 test:
  - `GET /api/budgets/[id]`: 6 test (401, 400, 404, 200 shape, Cache-Control, no leak)
  - `GET /api/budgets/[id]/history`: 5 test (401, 400, 404, 200 con 12 punti, Cache-Control)

### Bug corretti durante i test
1. **Precisione floating-point**: `dailyAvgSpend` veniva arrotondato prima della moltiplicazione → `round2(9.68) * 31 = 300.08`. Fix: moltiplicare il valore grezzo e arrotondare solo il risultato finale.
2. **`as const` su ternary**: TypeScript non accetta `as const` su espressioni ternarie. Fix: importato tipo `BudgetStatus` e usato `as BudgetStatus`.
3. **Test `repeated_overrun`**: i dati di test avevano le categorie "exceeded" nei primi 2 mesi, ma `slice(-6)` guarda gli ultimi 6. Fix: spostato i mesi exceeded agli indici 10-11 (mesi 11-12).

## 13. Build e TypeScript — Controllo finale pre-commit

### Comandi eseguiti e exit code

| Comando | Exit code | Esito |
|---------|-----------|-------|
| `npx vitest run` | **0** | 392 test passati, 14 skipped, 0 falliti |
| `npm run build` | **0** | Build di produzione completata con successo |
| `npx tsc --noEmit` | **2** | 4 errori — tutti pre-esistenti (vedi sotto) |

### Errori TypeScript pre-esistenti (fuori scope Sprint 7B)

Rilevati con `npx tsc --noEmit`. Tutti e 4 si trovano in file del sottosistema Backup/Restore **non toccati da Sprint 7B**.

| # | File | Riga | Errore completo |
|---|------|------|-----------------|
| 1 | `tests/api/backup-restore-route.test.ts` | 70 | `error TS2339: Property 'unknown' does not exist on type 'Partial<AuroraBackupRecordCounts>'.` |
| 2 | `tests/unit/backup/backup-core.test.ts` | 178 | `error TS2339: Property 'unknown' does not exist on type 'Partial<AuroraBackupRecordCounts>'.` |
| 3 | `tests/unit/backup/backup-core.test.ts` | 388 | `error TS2339: Property 'unknown' does not exist on type 'Partial<AuroraBackupRecordCounts>'.` |
| 4 | `tests/unit/backup/backup-restore-dry-run.test.ts` | 173 | `error TS2551: Property 'account2' does not exist on type '{ user: string; account: string; savings: string; ... }'. Did you mean 'account'?` |

### Prova di pre-esistenza

Verifica: `git diff HEAD --name-only` — i 3 file con errori **non compaiono** tra i file modificati da Sprint 7B.

```
# File modificati/aggiunti in Sprint 7B (git diff HEAD + untracked):
src/app/(app)/budgets/page.tsx
src/app/(app)/budgets/[id]/           ← nuovo
src/app/(app)/dashboard/page.tsx
src/app/api/budgets/[id]/route.ts
src/app/api/budgets/[id]/history/     ← nuovo
src/app/api/budgets/route.ts
src/lib/budgets/service.ts
src/lib/dashboard/service.ts
tests/api/budgets-route.test.ts
tests/unit/budgets/service-7b.test.ts ← nuovo
tests/unit/dashboard/service.test.ts
audit/BUDGET_SPRINT_7B_RESULTS.md     ← nuovo
```

```
# File con errori TypeScript — ultimo commit che li ha toccati:
tests/api/backup-restore-route.test.ts      → 6842aae (Sprint 5D)
tests/unit/backup/backup-core.test.ts       → 6842aae (Sprint 5D)
tests/unit/backup/backup-restore-dry-run.test.ts → 6842aae (Sprint 5D)
```

Il commit `6842aae` (Sprint 5D) è **precedente** a Sprint 7W (`6588bca`) e a Sprint 7B. Gli errori sono stati introdotti in Sprint 5D e non rientrano nello scope di questo sprint.

### Perché la build di produzione (exit 0) non segnala questi errori

`npm run build` usa il compilatore TypeScript integrato di Next.js/Turbopack, che esclude i file di test (`tests/**`) dalla compilazione di produzione. `npx tsc --noEmit` invece include i test perché li copre il `tsconfig.json` radice. I 4 errori non riguardano codice di produzione.

## 14. Migration

Nessuna migration necessaria. Sprint 7B opera interamente a livello applicativo sullo schema esistente:
- Tabelle usate: `budgets`, `categories`, `transactions`, `accounts`
- RLS: tutte le query rispettano l'ownership utente via RLS Supabase
- Nessuna nuova colonna, tabella o funzione PostgreSQL

## 15. Limiti e decisioni da confermare

### Limiti noti
| Area | Limite | Motivazione |
|------|--------|-------------|
| Storico | Solo 12 mesi a ritroso | Bilanciamento query vs utilità |
| Transazioni dettaglio | Max 50 per pagina (UI mostra 10 con "show all") | Performance |
| Insight dashboard | Max 3 (budget) + insight esistenti dashboard | Spazio UI |
| Insight pagina budget | Max 5 totali per tipo | Leggibilità |
| `topProjectedRisks` | Max 3 categorie | Priorità visiva |

### Decisioni di design
1. **Arrotondamento su valore grezzo**: `projectedSpent` usa il daily avg non arrotondato per evitare errori di precisione. `dailyAvgSpend` (display) resta arrotondato.
2. **Trend 'unavailable'**: quando il mese precedente ha 0 spese e il corrente > 0, il trend è `unavailable` (non `up`) per evitare percentuali infinite.
3. **Soglia stabilità 3%**: variazioni < 3% sono considerate stabili per evitare rumore visivo su piccole variazioni.
4. **Un solo alert reale per categoria**: viene mostrato solo il livello più alto per non sovraccaricare l'utente.
5. **`hadBudget=false` nei punti storici**: mesi senza budget vengono inclusi nella serie (per continuità grafica) ma esclusi dalle analisi insight.
6. **No N+1**: tutta la logica storica usa query bulk caricate una sola volta e processate in memoria.
