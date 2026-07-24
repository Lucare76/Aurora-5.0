# Sprint 10 - Report Finanziari Avanzati

## Architettura

Lo sprint introduce una nuova area Report centralizzata:

- `src/lib/reports/types.ts`: contratto dati, filtri, KPI, insight, errori applicativi.
- `src/lib/reports/calculations.ts`: calcoli puri e testabili.
- `src/lib/reports/service.ts`: validazione parametri, query Supabase e composizione payload.
- `src/app/api/reports/route.ts`: endpoint autenticato `GET /api/reports`.
- `src/app/(app)/reports/page.tsx`: UI client con una sola fetch verso l'API.

La pagina React non contiene query Supabase dirette. I calcoli riusano le regole contabili esistenti tramite `adaptTransactionRows`, `isCountableIncome`, `isCountableExpense` e `calculateTransferTotal`.

## Definizioni Contabili

- Entrate conteggiabili: transazioni `income` senza riferimento di trasferimento.
- Uscite conteggiabili: transazioni `expense` senza riferimento di trasferimento.
- Trasferimenti interni: esclusi da entrate, uscite e cash flow; mostrati come `internalTransfersAmount`.
- Patrimonio netto: somma dei saldi dei conti attivi, coerente con la Dashboard.
- Sottocategorie: aggregate nella categoria padre, con dettaglio figlio disponibile nella riga.
- Spese fisse: solo uscite collegate a `recurring_id`; le altre restano variabili/non classificate.

## Formule

- `netCashFlow = totalIncome - totalExpenses`
- `savingsRate = (netCashFlow / totalIncome) * 100`, solo se `totalIncome > 0`
- `averageMonthlyIncome = totalIncome / mesi del periodo`
- `averageMonthlyExpenses = totalExpenses / mesi del periodo`
- `netWorthChange = netWorthEnd - netWorthStart`
- confronto percentuale: non disponibile quando il valore precedente e' zero.

## Filtri

Sono supportati tramite URL:

- `range=current-month`
- `range=previous-month`
- `range=last-3-months`
- `range=last-6-months`
- `range=current-year`
- `range=previous-year`
- `range=last-12-months`
- `range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`
- `account=<uuid>`
- `category=<uuid>`
- `type=both|income|expense|all`
- `includeTransfers=true|false`
- `includeArchivedAccounts=true|false`

L'intervallo custom massimo e' 5 anni.

## API

Endpoint:

```http
GET /api/reports
```

Risposta:

- `filters`
- `period`
- `previousPeriod`
- `summary`
- `comparison`
- `monthlySeries`
- `expenseCategories`
- `incomeCategories`
- `fixedVariable`
- `netWorth`
- `records`
- `insights`
- `accounts`
- `metadata`

Header:

```http
Cache-Control: no-store
```

Errori applicativi:

- `UNAUTHORIZED`
- `INVALID_RANGE`
- `INVALID_DATE`
- `RANGE_TOO_LARGE`
- `INVALID_ACCOUNT`
- `INVALID_CATEGORY`
- `REPORT_FAILED`

Gli errori interni Supabase non vengono esposti al client.

## KPI

Il report calcola:

- entrate totali;
- uscite totali;
- cash flow netto;
- tasso di risparmio;
- medie mensili;
- transazione massima in entrata e uscita;
- conteggio movimenti;
- numero conti attivi;
- patrimonio iniziale/finale;
- variazione patrimonio;
- trasferimenti interni.

## Confronto Periodi

Per ogni intervallo viene creato un periodo precedente equivalente. I trend possibili sono:

- `UP`
- `DOWN`
- `STABLE`
- `NOT_AVAILABLE`

La soglia `STABLE` e' una variazione inferiore al 3%.

## Serie Mensile

La serie mensile include anche mesi senza movimenti e contiene:

- mese;
- entrate;
- uscite;
- cash flow;
- tasso di risparmio;
- numero movimenti;
- cash flow cumulativo;
- patrimonio netto stimato a fine mese.

## Categorie

La vista predefinita aggrega per categoria padre. Le sottocategorie restano nel campo `children`.

Gestione inclusa:

- categoria padre/figlio;
- senza categoria;
- categoria eliminata;
- percentuali su totale;
- ranking;
- confronto con periodo precedente.

## Fisse / Variabili

La classificazione e' conservativa:

- fissa solo se la transazione ha `recurring_id`;
- variabile/non classificata negli altri casi.

Non vengono inferite ricorrenze dalla ripetizione testuale dei movimenti.

## Insight

Gli insight sono deterministici, server-side, massimo 5 e senza duplicati.

Tipi coperti:

- aumento/diminuzione entrate;
- aumento/diminuzione uscite;
- tasso di risparmio negativo o migliorato;
- spike categoria;
- aumento/diminuzione patrimonio;
- serie positiva/negativa di cash flow;
- dati insufficienti.

## Tabella

La pagina mostra una tabella con tre viste:

- mensile;
- categorie;
- conti.

L'ordinamento e' applicato su dataset gia' aggregati.

## Drill-Down

I link navigano verso `/transactions` con parametri compatibili:

- `from`
- `to`
- `account`
- `category`
- `type`

La pagina movimenti legge questi parametri come filtri iniziali.

## CSV

Export lato browser, senza nuove dipendenze:

- UTF-8 con BOM;
- separatore `;`;
- celle escapate con virgolette;
- sezioni riepilogo, mesi, categorie di uscita, categorie di entrata, conti;
- filename `aurora-report-YYYY-MM-DD-YYYY-MM-DD.csv`.

## Stampa

La pagina usa CSS `@media print`.

In stampa vengono nascosti:

- sidebar;
- header mobile;
- bottom nav;
- filtri;
- pulsanti export/stampa.

Sono mantenuti KPI, grafici, tabelle, insight e note contabili.

## Sicurezza

- Endpoint autenticato.
- Query eseguite con client Supabase server e RLS.
- Validazione UUID per account e categoria.
- Verifica ownership logica sui record ritornati da RLS.
- `Cache-Control: no-store`.
- Nessun service role nel browser.
- Nessun dato `user_id` nel payload UI/API.

## Performance

La strategia e' ibrida e testabile:

- 4 query parallele;
- select esplicite;
- nessun N+1;
- nessuna query per mese;
- nessuna query per categoria;
- una sola fetch client;
- `AbortController` quando cambiano i filtri.

## Numero Query

`metadata.queryCount = 4`:

1. conti;
2. categorie;
3. transazioni nel periodo necessario;
4. ricorrenze attive.

## Test

Creati:

- `tests/unit/reports/calculations.test.ts`
- `tests/api/reports-route.test.ts`

Casi coperti:

- entrate;
- uscite;
- cash flow;
- trasferimenti esclusi;
- tasso di risparmio;
- entrate zero;
- periodo precedente;
- cambio anno;
- anno bisestile;
- range troppo lungo;
- mesi vuoti;
- categorie padre/figlio;
- fisse/variabili;
- confronto stabile;
- divisione per zero;
- insight;
- API autenticata;
- `no-store`;
- validazione parametri;
- ownership;
- errore DB mascherato.

## Limiti E Decisioni

- Nessuna migration introdotta.
- Nessuna RPC nuova introdotta.
- La stima storica del patrimonio segue la stessa impostazione della Dashboard: patrimonio corrente meno flussi netti successivi.
- Le spese fisse non vengono dedotte euristicamente.
- Non e' stato introdotto un generatore PDF server-side.
- I test manuali completi richiedono una sessione browser con dati reali.
