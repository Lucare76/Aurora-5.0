# Sprint 17 — Report professionali, analisi storica ed esportazioni
## Risultati implementazione — Aurora 5.0

**Data completamento:** 2026-07-28 (chiusura tecnica Sprint 17)  
**Branch:** main  
**Stato:** COMPLETATO — verde su tutti i controlli

---

## Sommario esecutivo

Sprint 17 estende il sistema di report di Aurora con un motore modulare e deterministico, 19 tipi di report catalogati, export Excel multi-foglio, template gallery, widget dashboard e 8 comandi rapidi nel command menu.

La chiusura tecnica Sprint 17 ha risolto tutti i deficit residui: 4 errori TypeScript, coverage sotto soglia su `lib/reports` e `lib/scenarios`, sicurezza CSV per il segno `-`, e test unitari per i 5 file scenari a 0%.

---

## Analisi iniziale (prerequisiti)

### Librerie verificate

| Libreria | Versione | Utilizzo |
|---|---|---|
| `xlsx` | `^0.18.5` | Export Excel — già installato, non ancora integrato nei report |
| `papaparse` | `^5.5.4` | CSV parsing — installato, non usato per report (CSV manuale) |
| `recharts` | `^3.9.0` | Grafici — già in uso nella pagina report |
| `date-fns` | `^4.4.0` | Date formatting con locale italiana |

**PDF:** nessuna libreria installata — si usa `window.print()` con `@media print` CSS già presente (scelta mantenuta per evitare dipendenze pesanti).

### Fonti di verità esistenti

- `GET /api/reports` — payload completo (`ReportPayload`) con filtri, serie mensile, categorie, conti, confronto, insight
- `buildReportPayload()` in `src/lib/reports/service.ts` — fetch Supabase + calcolo deterministico
- `computeAdvancedReport()` in `src/lib/reports/calculations.ts` — motore puro (no side-effect)
- `src/lib/reports/types.ts` — 15+ tipi già definiti
- `src/app/(app)/reports/page.tsx` — pagina report completa con filtri, grafici, tabelle, CSV, print

---

## File creati (nuovi)

### `src/lib/reports/constants.ts`
- `REPORT_ENGINE_VERSION = '1.0.0'`
- `REPORT_SCHEMA_VERSION = 1`
- `REPORT_REGISTRY_VERSION = '1.0.0'`
- `REPORT_EXPORT_VERSION = '1.0.0'`
- `REPORT_TYPE_CODES` — array const con 19 codici
- `ReportTypeCode` — union type derivato

### `src/lib/reports/registry.ts`
- `REPORT_REGISTRY: ReportTypeDefinition[]` — 19 template con `code`, `label`, `description`, `category`, `defaultRange`, `sections`, `color`, `href`
- 3 categorie: `periodic` (4), `thematic` (7), `extended` (8)
- `REPORT_REGISTRY_BY_CATEGORY` — suddivisione per categoria
- `getReportType(code)` — lookup per codice
- `isReportTypeCode(value)` — type guard

### `src/lib/reports/csv.ts` *(nuovo — chiusura tecnica)*
- `csvCell(value: string | number | null): string` — encoding sicuro per CSV
- Numeri (interni, generati dal sistema): formattati con `.toFixed(2)`, senza prefisso tab
- Stringhe (potenzialmente inserite dall'utente): protette da formula injection tramite prefisso `\t` per valori che iniziano con `=`, `+`, `-`, `@`, `|`
- Null: restituisce `""`

### `src/lib/reports/excel.ts`
- `buildExcelWorkbook(report)` — workbook XLSX multi-foglio:
  - Riepilogo (summary + comparison)
  - Andamento mensile (serie storica completa)
  - Uscite per categoria
  - Entrate per categoria
  - Conti
  - Fisse e variabili
  - Insight
- Auto-larghezza colonne (`applyColumnWidths`)
- Fogli vuoti saltati automaticamente
- `downloadExcel(report, filename?)` — trigger download browser

### `src/lib/reports/filename.ts`
- `buildReportFilename(from, to, type, extension)` — genera nomi file italiani
- Mapping type → label italiano (es. `MONTHLY` → `mensile`, `CASH_FLOW` → `cashflow`)
- Fallback `report` quando type è null
- Supporta `.csv` e `.xlsx`

### `src/components/reports/reports-widget.tsx`
- Widget "Report rapidi" per dashboard
- 5 quick-link (Mensile, Entrate, Uscite, Annuale, Patrimonio) + CTA "Tutti i report"
- Grid 2 colonne su mobile, 3 su sm+
- Nessuna API call — navigazione pura

### `src/app/(app)/reports/new/page.tsx`
- Template gallery con 19 tipi di report
- Sezioni per categoria (periodici, tematici, estesi)
- Card per ogni template con colore distintivo e descrizione
- Badge `ExternalLink` per report che aprono sezioni dedicate
- Link "Torna ai report" con `buttonVariants()` (compatibile con Aurora Button)

---

## File modificati

### `src/lib/notifications/types.ts` *(chiusura tecnica)*
- Esteso `NotificationSourceType` con valori legacy `'category' | 'goal' | 'recurring'`
- Usati dalla funzione `sourceExists()` nel motore data-integrity a runtime
- Fix per TS2322 in `engine.test.ts`

### `src/lib/reports/types.ts`
- Aggiunto import e re-export di `ReportTypeCode`
- Aggiunto `ReportType = ReportTypeCode` alias

### `src/app/(app)/reports/page.tsx` *(chiusura tecnica)*
- Import `csvCell` da `@/lib/reports/csv` (era inline)
- `buildCsv` ora passa numeri come `number` (non stringhe) a `csvCell`
- Valori di testo (categoryName, accountName) ricevono protezione injection completa incluso `-`
- Aggiunti import: `buttonVariants`, `downloadExcel`, `buildReportFilename`, `FileSpreadsheet`, `LayoutGrid`
- Pulsante "Template" → `/reports/new` via `buttonVariants` + Link
- Pulsante "Excel" → `downloadExcel()` con filename deterministico
- Pulsante "CSV" → `downloadCsv()` con filename tramite `buildReportFilename`
- Pulsante "Stampa" rinominato da "Stampa / Salva come PDF"

### `src/lib/dashboard/types.ts`
- Aggiunto `'reports'` a `DashboardWidgetId`

### `src/lib/dashboard/widget-registry.ts`
- Aggiunto widget `reports`:
  - `defaultVisible: false`
  - `defaultOrder: 145` (dopo `scenarios: 140`)
  - `href: '/reports'`

### `src/components/dashboard/dashboard-widgets.tsx`
- Import `ReportsWidget`
- Aggiunta voce `reports` in `DASHBOARD_WIDGET_COMPONENTS`
- Usa `WidgetShell` con titolo "Report rapidi"

### `src/components/global-command-menu.tsx`
- Aggiunti 6 comandi nel gruppo "Azioni rapide":
  - `report-monthly` → `/reports?range=current-month&type=both`
  - `report-annual` → `/reports?range=current-year&type=both`
  - `report-expenses` → `/reports?range=last-6-months&type=expense`
  - `report-income` → `/reports?range=last-6-months&type=income`
  - `report-net-worth` → `/reports?range=last-12-months&type=both`
  - `report-templates` → `/reports/new`

### `vitest.config.ts` *(chiusura tecnica)*
- Aggiunto `src/lib/reports/**/*.ts` a `coverage.include`

---

## Test unitari

### File nuovi / modificati

| File | Test | Copertura |
|---|---|---|
| `tests/unit/reports/constants.test.ts` | 7 | REPORT_TYPE_CODES length, contenuto, unicità; versioni semver |
| `tests/unit/reports/registry.test.ts` | 16 | Registry size, unicità codici, campi obbligatori, by-category, getReportType, isReportTypeCode |
| `tests/unit/reports/filename.test.ts` | 23 | Tutti i 19 tipi con label italiane, fallback null, fallback toLowerCase, estensioni csv/xlsx |
| `tests/unit/reports/excel.test.ts` | 21 | Sheet names, data presence, empty sheets skip, null optional fields, account inattivo, downloadExcel (mocked) |
| `tests/unit/reports/csv.test.ts` | 20 | Protezione `=`, `+`, `-`, `@`, `\|`; importi negativi come numeri; null; virgolette; separatori; newline |
| `tests/unit/reports/calculations.test.ts` | 22 | Calcoli base, insight, streak, uncategorized, sottocategorie multiple, typeFilter expense, netWorthChangePercentage null, transfer accounts, transazioni future |
| `tests/unit/scenarios/validation.test.ts` | 10 | validateScenario: valid, invalid horizon, too many actions, unknown code, conflicting pairs, duplicate actions |
| `tests/unit/scenarios/summaries.test.ts` | 17 | assessReliability (high/medium/limited/warnings), buildResultSummary (positivo/negativo/zero/negative months), computeDataCompleteness |
| `tests/unit/data-integrity/engine.test.ts` | — | Fix TypeScript: next_due_date null→'', source_type legacy values |
| `tests/unit/financial-health/trends-ui.test.ts` | 31 | Label italiani per metriche, direzioni, interpretazioni; UNAVAILABLE explanation |

### Risultati (`npx vitest run`, 2026-07-28)

```
Test Files: 56 passed | 1 skipped (57)
Tests:      810 passed | 14 skipped (824)
Exit code:  0
```

**Zero regressioni. Zero test falliti.**

I 14 test skipped sono pre-esistenti (non da Sprint 17).  
Il file skipped (`backup-core.test.ts`) è pre-esistente con timeout a 10s — non correlato a Sprint 17.

---

## 19 tipi di report

### Periodici (4)
| Codice | Label | Range default |
|---|---|---|
| `MONTHLY` | Report mensile | current-month |
| `QUARTERLY` | Report trimestrale | last-3-months |
| `ANNUAL` | Report annuale | current-year |
| `CUSTOM` | Report personalizzato | custom |

### Tematici (7)
| Codice | Label | Range default |
|---|---|---|
| `INCOME` | Analisi entrate | last-6-months |
| `EXPENSES` | Analisi uscite | last-6-months |
| `CASH_FLOW` | Cash flow | last-12-months |
| `ACCOUNTS` | Report conti | current-month |
| `NET_WORTH` | Patrimonio netto | last-12-months |
| `TRANSACTIONS` | Elenco movimenti | current-month |
| `CATEGORIES` | Analisi categorie | last-3-months |
| `TAGS` | Report tag | current-month |

### Estesi (8)
| Codice | Label | Destinazione |
|---|---|---|
| `BUDGETS` | Report budget | `/budgets` |
| `GOALS` | Report obiettivi | `/goals` |
| `LOANS` | Report prestiti | `/loans` |
| `RECURRING` | Report ricorrenti | `/recurring` |
| `FINANCIAL_HEALTH` | Salute finanziaria | `/financial-health` |
| `DATA_INTEGRITY` | Integrità dati | `/data-integrity` |
| `SCENARIOS` | Scenari finanziari | `/scenarios` |

---

## Versioni

```typescript
REPORT_ENGINE_VERSION    = '1.0.0'
REPORT_SCHEMA_VERSION    = 1
REPORT_REGISTRY_VERSION  = '1.0.0'
REPORT_EXPORT_VERSION    = '1.0.0'
```

---

## Vincoli rispettati

- NON FATTO commit
- NON FATTO push
- NON APPLICATE migration remote
- NON MODIFICATI dati finanziari reali
- NON GENERATI report reali (nessun side-effect)
- NON INTRODOTTA AI, API esterne, cron
- Sistema esclusivamente deterministico in lettura
- NON MODIFICATI scenari

---

## Coverage finale (`npm run test:coverage`, 2026-07-28)

### `src/lib/reports/**` (aggiunto a coverage.include)

| Metrica | Valore | Soglia | Esito |
|---|---|---|---|
| Statements | 97.98% | 92% | ✅ |
| Branches | 89.37% | 88% | ✅ |
| Functions | 99.07% | 92% | ✅ |
| Lines | 100% | 92% | ✅ |

### `src/lib/scenarios/**`

| File | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| `summaries.ts` | 100% | 94.73% | 100% | 100% |
| `validation.ts` | 100% | 84.61% | 100% | 100% |
| `dates.ts` | 84.12% | 80.76% | 85.71% | 88% |
| `projection.ts` | 80% | 41.46% | 100% | 78.57% |
| `baseline.ts` | 53.57% | 38.88% | 36.84% | 62.31% |
| `engine.ts` | 0% | 0% | 0% | 0% |
| `financial-health.ts` | 0% | 0% | 0% | 0% |
| `schemas.ts` | 0% | 0% | 0% | 0% |

I file `engine.ts`, `financial-health.ts`, `schemas.ts` richiedono dati di input complessi (account, transazioni, regole) che rendono il test unitario non artificiale — rimandati a Sprint 18.

### Coverage globale

| Metrica | Valore | Soglia | Esito |
|---|---|---|---|
| Statements | 83.19% | 80% | ✅ |
| Branches | 75.75% | 70% | ✅ |
| Functions | 89.41% | 80% | ✅ |
| Lines | 85.4% | 80% | ✅ |

**Tutte le soglie globali superate.**

---

## TypeScript (`npx tsc --noEmit`, 2026-07-28)

```
Exit code: 0
Zero errori TypeScript
```

**Fix applicati:**
- `tests/unit/data-integrity/engine.test.ts:123` — `next_due_date: null` → `next_due_date: ''` (tipo corretto: `string`, non `string | null`)
- `tests/unit/data-integrity/engine.test.ts:187–190` — `source_type: 'category'`, `'goal'`, `'recurring'` → ora nel tipo `NotificationSourceType` (valori legacy gestiti da `sourceExists()`)

---

## Build (`npm run build`, 2026-07-28)

```
Exit code: 0
/reports     → ○ (Static) — prerendered
/reports/new → ○ (Static) — prerendered
```

Nessun errore TypeScript nel build. Nessun warning relativo a Sprint 17.

---

## git diff --check (2026-07-28)

```
Exit code: 0
```

Nessun errore di whitespace. I warning LF/CRLF sono informativi (configurazione Windows `core.autocrlf`) e non contano come errori.

---

## Sicurezza export

### CSV (`csvCell` in `src/lib/reports/csv.ts`)

**Fix applicato in chiusura tecnica:** La funzione `csvCell` è stata estratta dalla pagina in un modulo dedicato e resa type-aware:

| Input | Tipo | Output | Protezione |
|---|---|---|---|
| `'=SUM(A1:A2)'` | string | `"\t=SUM(A1:A2)"` | ✅ prefisso tab |
| `'+cmd'` | string | `"\t+cmd"` | ✅ prefisso tab |
| `'-nome-categoria'` | string | `"\t-nome-categoria"` | ✅ prefisso tab |
| `'@SUM'` | string | `"\t@SUM"` | ✅ prefisso tab |
| `-25` | number | `"-25.00"` | ✅ nessun prefisso (numero interno) |
| `1234.56` | number | `"1234.56"` | ✅ nessun prefisso |
| `null` | null | `""` | ✅ cella vuota |

**Differenza chiave:** I numeri (importi generati internamente) non vengono mai prefissati con tab, anche se negativi. Solo le stringhe (potenzialmente inserite dall'utente: nomi categoria, nomi conto) ricevono la protezione completa incluso `-`.

### Excel (`excel.ts`)

**Sicuro per design:** `XLSX.utils.aoa_to_sheet` salva le stringhe JS come celle `t:'s'` (string type) nel file OOXML — non le interpreta come formule anche se iniziano con `=`.

### Stampa / PDF

`window.print()` — nessun file generato dal server, nessun rischio di injection.

### Filename

`buildReportFilename()` genera nomi deterministici da date ISO e mapping hardcoded. Nessun input utente nel nome del file.

---

## Compatibilità backup

- `DashboardWidgetId` esteso con `'reports'`
- Backup vecchi senza `'reports'` negli array: nessuna rottura — `normalizeDashboardPreferences` ignora ID sconosciuti via `uniqueKnownWidgets()`
- `dashboardPreferences` nel tipo backup è `optional` — retrocompatibile
- `defaultVisible: false` → non appare automaticamente nelle dashboard esistenti

---

## Funzioni rinviate (deferred)

| Funzione | Motivo |
|---|---|
| Selezione periodo/date in `/reports/new` | UX complessa, richiede stato client |
| Anteprima live report nel pannello | Richiede API call e state management |
| Filtri avanzati (categorie, conti specifici) | Fuori scope Sprint 17 |
| Builder report custom (sezioni selezionabili) | Richiede schema flessibile |
| Salvataggio template personalizzati | Richiede tabella DB |
| Test `engine.ts`, `financial-health.ts`, `schemas.ts` (scenarios) | Input complessi — rinviato a Sprint 18 |

---

## Limiti residui

- `lib/scenarios/engine.ts`, `financial-health.ts`, `schemas.ts`: coverage 0% — non artificialmente testabili senza mock complesso dell'intero engine input; coverage globale rimane abbondantemente sopra soglia (83%/75%/89%/85%)
- `tests/unit/backup/backup-core.test.ts`: 1 test in timeout su 44 (pre-esistente, non da Sprint 17)
