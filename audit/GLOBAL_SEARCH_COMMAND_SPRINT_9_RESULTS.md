# Sprint 9A + 9B - Ricerca Globale e Centro Comandi

## Sintesi

Lo sprint introduce un pannello globale disponibile nel layout autenticato di Aurora. Il pannello combina ricerca multi-modulo e centro comandi, accessibile con pulsante UI, `Ctrl+K` su Windows/Linux e `Cmd+K` su macOS.

Non sono state create migration. Non sono stati usati servizi esterni, OpenAI, API a pagamento o nuove dipendenze.

## Architettura

File creati:

- `src/lib/search/types.ts`
- `src/lib/search/service.ts`
- `src/app/api/search/route.ts`
- `src/hooks/use-global-search.ts`
- `src/components/global-command-menu.tsx`
- `src/components/global-search-trigger.tsx`
- `tests/unit/search/service.test.ts`
- `tests/api/search-route.test.ts`
- `audit/GLOBAL_SEARCH_COMMAND_SPRINT_9_RESULTS.md`

File modificati:

- `src/app/(app)/layout.tsx`
- `src/app/(app)/transactions/page.tsx`
- `src/app/(app)/budgets/page.tsx`
- `src/app/(app)/goals/page.tsx`
- `src/app/(app)/loans/page.tsx`
- `src/app/(app)/recurring/page.tsx`

Separazione:

- tipi e payload in `types.ts`;
- normalizzazione, ranking, query e grouping in `service.ts`;
- validazione/autenticazione in API route;
- debounce/fetch/abort in hook client;
- presentazione e tastiera nel command menu.

## Moduli Ricercabili

- Transazioni
- Conti
- Categorie
- Budget
- Obiettivi
- Prestiti
- Ricorrenze

Importazioni e Backup sono trattati come azioni/navigazione, non come contenuto indicizzato.

## Campi Ricercabili

Transazioni:

- descrizione
- note
- importo numerico

Conti:

- nome
- tipo

Categorie:

- nome
- tipo

Budget:

- mese
- anno
- importo e categoria come metadata quando disponibile

Obiettivi:

- nome
- note
- status
- target amount come metadata

Prestiti:

- controparte
- descrizione

Ricorrenze:

- descrizione
- frequenza

## Ranking

Ranking deterministico server-side:

- titolo esatto: 100
- prefisso titolo: 80
- titolo contiene query: 60
- subtitle contiene query: 40
- metadata contiene query: 20

Normalizzazione:

- trim
- collasso spazi
- case-insensitive
- rimozione accenti
- rimozione apostrofi
- confronto importi con virgola/punto/euro normalizzati lato service

## API

Endpoint:

- `GET /api/search?q=...`

Validazioni:

- autenticazione obbligatoria
- esattamente un parametro `q`
- query non vuota
- minimo 2 caratteri
- massimo 100 caratteri

Errori:

- `UNAUTHORIZED`
- `INVALID_QUERY`
- `QUERY_TOO_SHORT`
- `QUERY_TOO_LONG`
- `SEARCH_FAILED`

Response:

- `query`
- `groups`
- `totalResults`
- `truncated`

Header:

- `Cache-Control: no-store`

## Sicurezza e Ownership

La route usa il client Supabase server con sessione utente.

Ogni query applica:

- `eq('user_id', user.id)`
- RLS già attiva come ulteriore protezione

Non viene usato service role. Gli errori interni Supabase non vengono esposti al client.

## Pannello Globale

Integrato in `src/app/(app)/layout.tsx`.

Apertura:

- pulsante nella sidebar desktop;
- pulsante ricerca nell’header mobile;
- `Ctrl+K`;
- `Cmd+K`.

Comportamenti:

- focus automatico sull’input;
- Escape chiude;
- overlay cliccabile;
- scroll pagina bloccato quando aperto;
- freccia su/giù;
- Home/End;
- Invio per aprire;
- risultato attivo evidenziato e con `aria-selected`;
- ruoli `dialog`, `combobox`, `listbox`, `option`.

## Azioni Rapide

Gruppo “Azioni rapide”:

- Nuovo movimento
- Nuovo trasferimento
- Nuovo budget
- Nuovo obiettivo
- Aggiungi versamento
- Nuovo prestito
- Nuova ricorrenza
- Importa movimenti
- Crea backup

Gruppo “Navigazione”:

- Dashboard
- Movimenti
- Conti
- Categorie
- Budget
- Obiettivi
- Report
- Prestiti
- Ricorrenti
- Compleanni
- Impostazioni

## Gestione Form

Non sono stati duplicati form nel command menu.

Sono stati aggiunti parametri URL a basso rischio:

- `/transactions?action=create`
- `/transactions?action=create&type=transfer`
- `/budgets?action=create`
- `/goals?action=create`
- `/goals?action=contribution`
- `/loans?action=create`
- `/recurring?action=create`

Le pagine aprono i modali locali già esistenti.

## Performance

Debounce client:

- 300 ms

Soglie:

- 0 caratteri: azioni rapide e navigazione
- 1 carattere: solo azioni locali
- almeno 2 caratteri: fetch server

Limiti:

- massimo 5 risultati per gruppo
- massimo 30 risultati complessivi

Query:

- ricerca con query parallele per modulo via `Promise.all`
- select esplicite
- nessun N+1
- nessun caricamento completo tabella
- richieste obsolete annullate con `AbortController`
- nessuna fetch a query vuota o con un solo carattere

Numero massimo query per ricerca:

- 7 query principali parallele
- 1 query aggiuntiva opzionale per categorie dei budget trovati

## Test

Test aggiunti:

- service: normalizzazione, ranking, accenti, importi, grouping, limiti;
- API: autenticazione, validazione query, no-store, payload, occultamento errori interni.

I test UI event-driven completi non sono stati aggiunti perché l’infrastruttura UI attuale usa principalmente render statico server-side e non un ambiente browser interattivo. I flussi keyboard/responsive restano da verificare manualmente.

## Limiti Noti

- La ricerca transazioni non esegue ancora join full-text su nome conto/categoria; usa metadata disponibili dai risultati limitati.
- Non è stata introdotta indicizzazione full-text o `pg_trgm` per evitare migration premature.
- “Aggiungi versamento” apre il primo obiettivo attivo se presente; per selezione avanzata del goal dal command menu serve un submenu dedicato futuro.
- I link risultato vanno alla pagina più specifica realmente esistente: alcune entità senza dettaglio dedicato aprono la pagina elenco.

## Decisioni

- Nessuna migration.
- Nessuna dipendenza nuova.
- Nessun service role.
- Nessun dato sensibile salvato nel browser.
- Nessun command parser libero o AI.
