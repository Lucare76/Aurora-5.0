# Financial Health Sprint 14A Results

## Architettura

Sprint 14A introduce un motore deterministico per la salute finanziaria in `src/lib/financial-health/`.

Il motore e' separato in:

- `types.ts`: input normalizzati, output, fattori, trend e raccomandazioni.
- `constants.ts`: pesi, soglie, livelli e versione calcolo.
- `helpers.ts`: date, arrotondamenti, clamp e formatter controllati.
- `data-quality.ts`: qualita' dati e provisional score.
- `liquidity.ts`: liquidita' e saldi previsti.
- `savings.ts`: risparmio, margine e stabilita' cash flow.
- `budgets.ts`: utilizzo budget e sforamenti.
- `debt.ts`: debito residuo e incidenza rate.
- `deadlines.ts`: scadenze previste e scadute.
- `goals.ts`: progresso obiettivi e traiettoria attesa.
- `alerts.ts`: avvisi attivi con penalita' limitata.
- `score.ts`: rinormalizzazione pesata.
- `trends.ts`: trend con interpretazione specifica per metrica.
- `recommendations.ts`: azioni deterministiche non regolamentate.
- `engine.ts`: orchestrazione pura senza Supabase.
- `service.ts`: query Supabase, normalizzazione e riuso del calendario finanziario.
- `snapshot-service.ts`: lettura e salvataggio snapshot mensili.

Le funzioni pure non importano Supabase e non eseguono query.

## Migration

Creata migration locale:

`supabase/migrations/00022_financial_health_snapshots.sql`

La migration non e' stata applicata da Codex.

Tabella:

`public.financial_health_snapshots`

Colonne principali:

- `id`
- `user_id`
- `period_key`
- `period_start`
- `period_end`
- `total_score`
- `level`
- `is_provisional`
- `data_quality`
- `observed_weight`
- `metrics`
- `component_scores`
- `factors`
- `recommendations`
- `calculation_version`
- `calculated_at`
- `created_at`
- `updated_at`

Vincoli e indici:

- unique su `(user_id, period_key, calculation_version)`.
- check range score 0-100.
- indice `(user_id, period_start desc)`.
- indice `(user_id, calculated_at desc)`.
- indice `(user_id, level)`.

RLS:

- select solo proprie righe.
- insert solo proprie righe.
- update solo proprie righe.
- nessuna policy `USING (true)`.

La migration usa `create table if not exists`, `add column if not exists`, `drop policy if exists`, `drop trigger if exists`, `create index if not exists` e blocchi `DO` per constraint.

## Versione Calcolo

`FINANCIAL_HEALTH_CALCULATION_VERSION = "1.0"`

Gli snapshot salvano la versione per distinguere formule future.

## Input Motore

`FinancialHealthInput` riceve dati gia' normalizzati:

- conti;
- categorie;
- transazioni;
- saldi previsti;
- ricorrenze;
- budget;
- obiettivi;
- versamenti obiettivi;
- prestiti;
- pagamenti prestiti;
- notifiche;
- periodo;
- periodo precedente;
- metriche mensili storiche.

## Output Motore

`FinancialHealthResult` restituisce:

- score totale;
- livello testuale;
- qualita' dati;
- confidenza;
- metriche principali;
- 7 componenti;
- pesi;
- contributi;
- fattori positivi, negativi e neutrali;
- raccomandazioni;
- trend;
- warning.

## Formule e Soglie

I pesi sono centralizzati:

- Liquidita' e saldi previsti: 25.
- Capacita' di risparmio: 20.
- Budget: 15.
- Debito: 15.
- Scadenze: 10.
- Obiettivi: 10.
- Avvisi: 5.

I livelli sono:

- 0-39 Critica.
- 40-59 Da migliorare.
- 60-74 Discreta.
- 75-89 Buona.
- 90-100 Ottima.

Se un componente e' `NOT_APPLICABLE`, il peso viene escluso e lo score viene rinormalizzato.

## Data Quality

Livelli:

- `INSUFFICIENT`;
- `LIMITED`;
- `GOOD`;
- `EXCELLENT`.

Lo score viene comunque calcolato quando possibile, ma marcato `isProvisional` con confidenza ridotta.

## Double Counting

Gli avvisi hanno peso massimo 5 e penalita' limitata. Le notifiche che rappresentano condizioni gia' coperte da budget, saldo previsto, prestiti o obiettivi non vengono usate come seconda penalizzazione piena.

## API

Endpoint creati:

- `GET /api/financial-health`
- `GET /api/financial-health/history`
- `POST /api/financial-health/snapshot`

Tutti richiedono autenticazione, usano client anon autenticato via cookie, non usano service role e rispondono con `Cache-Control: no-store`.

Errori sicuri:

- `UNAUTHORIZED`;
- `INVALID_PERIOD`;
- `INVALID_DATE_RANGE`;
- `FINANCIAL_HEALTH_CALCULATION_FAILED`;
- `SNAPSHOT_SAVE_FAILED`;
- `SNAPSHOT_NOT_FOUND`;
- `INVALID_CALCULATION_VERSION`.

## Query e Performance

Il service live usa query parallele e finestre limitate:

- profilo;
- conti;
- categorie;
- transazioni massimo 12 mesi + orizzonte previsione;
- budget;
- ricorrenze;
- obiettivi;
- versamenti obiettivi;
- prestiti;
- pagamenti prestiti;
- notifiche opzionali.

Non ci sono query N+1.

Il limite transazioni live e' 10.000 righe; dataset molto piu' grandi richiederanno aggregazioni server-side nello Sprint 14B/14C.

## Valuta e Timezone

Le metriche numeriche restano numeri. La UI formatta in euro con formatter centrale.

Le date usano chiavi locali `YYYY-MM-DD` coerenti con il resto del progetto. Il timezone utente viene letto dal profilo e incluso nell'input, ma lo Sprint 14A non introduce una libreria timezone dedicata.

## Backup & Restore

Backup Export:

- aggiunto campo opzionale `financialHealthSnapshots`.
- la query e' non fatale se la tabella non esiste.
- gli snapshot non sono aggiunti a `BACKUP_COLLECTION_KEYS` per non rompere backup precedenti.

Backup Restore:

- rinviato.
- gli snapshot non sono fonte di verita' contabile.
- nessun ricalcolo automatico durante restore.

## Ricerca Globale

Aggiunti comandi:

- Apri salute finanziaria.
- Calcola salute finanziaria.
- Storico salute finanziaria.
- Salva snapshot del mese.

## UI Minima

Creata pagina:

`/financial-health`

Mostra:

- score;
- livello;
- qualita' dati;
- periodo;
- componenti;
- metriche principali;
- fattori positivi;
- fattori negativi;
- raccomandazioni;
- trend;
- pulsante snapshot;
- storico snapshot.

Include disclaimer: non e' valutazione creditizia ne' consulenza finanziaria.

## Accessibilita'

La pagina usa:

- testo del livello oltre al numero;
- progress bar con `aria-valuenow`;
- pulsante snapshot con label;
- liste semantiche per fattori;
- stati loading/errore;
- contrasto coerente con il design system light.

## Test

Aggiunti test unitari:

- qualita' dati insufficiente;
- esclusione giroconti da entrate/uscite;
- score deterministico;
- rinormalizzazione componenti non applicabili;
- budget assenti non penalizzati;
- liquidita' negativa;
- budget superati;
- debito assente;
- prestiti scaduti;
- obiettivi in ritardo;
- raccomandazioni deterministiche;
- trend specifici per metrica;
- alert con penalita' limitata;
- risultato provvisorio;
- score non disponibile solo con peso osservato zero;
- migration idempotente;
- RLS senza `USING (true)`.

## Limitazioni

- Nessuna dashboard grafica avanzata: rinviata a Sprint 14B.
- Nessun cron automatico per snapshot.
- Nessun ML, LLM o previsione probabilistica.
- Nessun restore degli snapshot.
- Nessuna aggregazione server-side dedicata per utenti con storico enorme.
- Il timezone utente e' trasportato nell'input ma le utilita' restano allineate alle date locali gia' usate dal progetto.

## Verifiche

Da eseguire al termine:

- `npx tsc --noEmit`
- `npx vitest run`
- `npm run test:coverage`
- `npm run build`
- `git diff --check`
