# Sprint 16 — Scenari finanziari e simulazioni "What if"
## Risultati di implementazione

**Data completamento:** 2026-07-27
**Branch:** main
**Stato:** Completato — build pulita, 698 test passati

---

## Obiettivo

Implementare un motore di simulazione finanziaria "what if" completo per Aurora 5.0.
Il sistema permette all'utente di creare scenari con azioni su entrate/uscite/risparmio/prestiti
e ottenere proiezioni mensili deterministiche su un orizzonte fino a 60 mesi.

**Vincoli rispettati:**
- Nessun commit, push o migration applicata
- Nessuna modifica a struttura contabile, importazioni, prestiti, ricorrenze, autenticazione
- Nessuna transazione reale, notifica reale, snapshot FH reale generata
- Nessuna AI, API esterne, cron, Monte Carlo, simulazioni probabilistiche
- Il motore è completamente side-effect free (solo `result_summary` su jsonb scenario)

---

## Architettura implementata

### Motore di simulazione (`src/lib/scenarios/`)

| File | Responsabilità |
|------|----------------|
| `types.ts` | Tutti i tipi: ScenarioAction, ProjectionPeriod, BaselineData, ActionModifications, ecc. |
| `schemas.ts` | Validazione Zod (v4 compatibile) |
| `constants.ts` | SIMULATION_BADGE, MONTH_LABELS_IT, SCENARIO_TEMPLATES |
| `registry.ts` | ACTION_REGISTRY, overloaded getActionsByCategory() |
| `money.ts` | roundMoney() — Math.round pattern |
| `dates.ts` | parseDateUTC, getPeriodKey (0-based), generatePeriods, monthsBetween |
| `assumptions.ts` | DEFAULT_ASSUMPTIONS |
| `baseline.ts` | buildBaseline() da ricorrenze, prestiti, obiettivi |
| `projection.ts` | dispatchAction(), mergeModifications(), projectScenario() |
| `comparison.ts` | buildComparison() — 6 metriche con direzione |
| `financial-health.ts` | simulateFinancialHealth() — 4 componenti, scoreToLevel() |
| `summaries.ts` | assessReliability(), buildResultSummary() |
| `validation.ts` | Controlli orizzonte, cap azioni, codici sconosciuti, mutualità |
| `engine.ts` | runScenarioEngine() — orchestrazione completa |
| `persistence.ts` | listScenarios, getScenario, createScenario, updateScenario, saveScenarioResult, deleteScenario, duplicateScenario |

### 16 action codes implementati

ONE_TIME_EXPENSE, RECURRING_EXPENSE_ADD/UPDATE/REMOVE, RECURRING_INCOME_ADD/REDUCE/PAUSE,
MONTHLY_SAVINGS_CHANGE, CATEGORY_SPENDING_CHANGE, BUDGET_LIMIT_CHANGE,
GOAL_CONTRIBUTION_CHANGE, GOAL_DEADLINE_CHANGE, GOAL_ONE_TIME_CONTRIBUTION,
LOAN_EARLY_PAYOFF, NEW_LOAN, ACCOUNT_BALANCE_ADJUSTMENT

### API Routes (`src/app/api/scenarios/`)

| Route | Metodi | Descrizione |
|-------|--------|-------------|
| `/api/scenarios` | GET, POST | Lista e creazione scenari |
| `/api/scenarios/[id]` | GET, PATCH, DELETE | CRUD singolo scenario |
| `/api/scenarios/[id]/calculate` | POST | Calcolo con salvataggio result_summary |
| `/api/scenarios/[id]/duplicate` | POST | Duplicazione scenario |
| `/api/scenarios/[id]/archive` | POST | Archiviazione |
| `/api/scenarios/calculate` | POST | Calcolo effimero (senza DB) |

### Pagine UI (`src/app/(app)/scenarios/`)

| Pagina | Descrizione |
|--------|-------------|
| `/scenarios` | Lista scenari — griglia responsive 1/2/3 colonne |
| `/scenarios/new` | Picker template — griglia 1/2/3, form nome/orizzonte |
| `/scenarios/[id]` | Editor + risultati — KPI cards, grafico, metriche confronto |

Tutte le pagine sono **fully responsive** (mobile-first, breakpoint sm/lg).

### Componenti (`src/components/scenarios/`)

| Componente | Descrizione |
|------------|-------------|
| `scenario-chart.tsx` | Recharts area chart — h-48 sm:h-64, tick adattivi |
| `scenario-results.tsx` | MetricRow, FH simulation card, reliability banner |
| `scenario-editor.tsx` | ActionCard collapsibile, ParamsEditor grid 1/2 colonne |
| `scenarios-widget.tsx` | Widget dashboard top-3 scenari ready con delta |

### Database (`supabase/migrations/00025_financial_scenarios.sql`)

```sql
create table if not exists public.financial_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  description text,
  status text not null default 'draft' check (status in ('draft','ready','outdated','archived')),
  horizon_months integer not null check (horizon_months between 1 and 60),
  start_date date not null, end_date date not null,
  currency text, actions jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '{}'::jsonb,
  engine_version text not null default '1.0.0',
  schema_version integer not null default 1,
  action_registry_version text not null default '1.0.0',
  baseline_as_of date, last_calculated_at timestamptz,
  result_summary jsonb, is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- RLS: (select auth.uid()) = user_id
```

### Integrazioni

- **Navigation**: `FlaskConical` aggiunto a navItems e moreItems in `(app)/layout.tsx`
- **Dashboard widget**: `scenarios` in `DashboardWidgetId`, registry, e `DASHBOARD_WIDGET_COMPONENTS`
- **Command menu**: 3 voci scenario (Nuovo scenario, I miei scenari, navigazione)
- **Backup export**: `financial_scenarios` export-only (non-fatal), tipo `AuroraBackupFinancialScenarioV1`
- **Test coverage config**: `src/lib/scenarios/**/*.ts` incluso, `**/persistence.ts` escluso

---

## Test

**6 file di test creati:**

| File | Test | Coverage |
|------|------|---------|
| `tests/unit/scenarios/money.test.ts` | roundMoney, precision |
| `tests/unit/scenarios/dates.test.ts` | parseDateUTC, getPeriodKey (0-based), generatePeriods, monthsBetween |
| `tests/unit/scenarios/registry.test.ts` | isKnownActionCode, getActionsByCategory (0 e 1 arg) |
| `tests/unit/scenarios/actions.test.ts` | applyOneTimeExpense, applyRecurringExpenseAdd, applyNewLoan, applyAccountBalanceAdjustment |
| `tests/unit/scenarios/projection.test.ts` | buildBaseline, projectScenario (baseline+modifiche) |
| `tests/unit/scenarios/comparison.test.ts` | buildComparison metriche e direzioni |

**Risultato finale:** 698 test passati, 0 fallimenti, 0 errori TypeScript Sprint 16.

---

## Fix applicati durante l'implementazione

| Problema | Fix |
|----------|-----|
| `Button asChild` non in ButtonProps | Usato `buttonVariants()` + `Link` su tutte le pagine |
| `z.record(z.unknown())` — Zod v4 richiede 2 argomenti | `z.record(z.string(), z.unknown())` |
| `readonly` array cast a tuple | `[...SCENARIO_STATUSES] as unknown as [string, ...string[]]` |
| Tooltip Recharts `formatter` type | `(value, name) => [fmtEur(Number(value)), ...]` |
| `getActionsByCategory` zero arg | Aggiunto overload e implementazione zero-arg |
| `date-fns` in API routes | Sostituito con `computeEndDate` helper (plain Date arithmetic) |
| `LoanPayment.date` → `paid_at` | Corretto in loan-payoff.ts |
| `AccountBalanceAdjustmentParams.adjustmentAmount` | Rimosso `accountId` e `date` inesistenti |
| `getPeriodKey` test 1-based vs 0-based | Test corretto: `getPeriodKey(2026, 0)` per gennaio |
| `applyNewLoan` `isRepaymentActive` falso nel mese payment | Aggiunto `started` flag — attiva dal mese del primo pagamento |
| Account mock mancante `color`, `icon`, `sort_order` | Aggiunto nel test di proiezione |

---

## Vincoli NON violati

- Nessuna transazione reale creata
- Nessuna notifica reale creata
- Nessuno snapshot Financial Health reale creato
- Nessuna issue Data Integrity reale creata
- Nessuna modifica alla struttura contabile di base
- Nessuna modifica a importazioni, prestiti reali, ricorrenze reali, autenticazione
- Nessun AI, API esterna, cron, Monte Carlo
- Nessun commit, push, migration applicata
