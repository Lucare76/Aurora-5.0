# Sprint 12 — Automazioni e Regole Finanziarie Deterministiche

## Obiettivo

Sprint 12 introduce un sistema deterministico per classificare movimenti tramite regole esplicite, spiegabili e verificabili. Il sistema non usa AI, servizi esterni, classificazioni probabilistiche o modifiche non tracciate.

## Architettura

Il sistema è diviso in livelli:

- `src/lib/automation/types.ts`: contratto applicativo per regole, condizioni, azioni, preview, batch e registro.
- `src/lib/automation/validators.ts`: validazione Zod lato server e limiti massimi.
- `src/lib/automation/matcher.ts`: matcher puro per condizioni.
- `src/lib/automation/actions.ts`: costruzione patch e controllo riferimenti.
- `src/lib/automation/conflicts.ts`: ordinamento stabile e conflitti a pari priorità.
- `src/lib/automation/engine.ts`: valutazione regole senza query interne.
- `src/lib/automation/service.ts`: query Supabase, preview, applicazione bulk, revert e storico.

Il motore puro non interroga Supabase. Riceve movimento, regole già caricate e riferimenti autorizzati.

## Schema Database

Migration locale:

- `supabase/migrations/00019_automation_rules.sql`

Tabelle:

- `automation_rules`
- `automation_application_batches`
- `automation_rule_applications`

Campi principali regole:

- `user_id`
- `name`
- `description`
- `is_active`
- `priority`
- `match_mode`
- `stop_processing`
- `apply_to_new_transactions`
- `archived`
- `conditions jsonb`
- `actions jsonb`

È stato scelto JSONB per condizioni e azioni perché il set è piccolo ma composabile. La validazione rigorosa è lato server con Zod e lato DB con limiti array.

## RLS

RLS abilitata su tutte le nuove tabelle.

Policy:

- select/insert/update/delete sulle proprie regole;
- select/insert/update sui propri batch;
- select/insert/update sulle proprie applicazioni.

Non è usato service role nei flussi normali.

## Indici

Indici aggiunti:

- `automation_rules(user_id, is_active, archived, priority, created_at, id)`
- `automation_rule_applications(user_id, transaction_id)`
- `automation_rule_applications(application_batch_id)`
- `automation_rule_applications(rule_id, applied_at desc)`
- `automation_application_batches(user_id, created_at desc)`

## Condizioni Supportate

Descrizione:

- `CONTAINS`
- `EQUALS`
- `STARTS_WITH`
- `ENDS_WITH`
- `NOT_CONTAINS`

Importo:

- `EQUALS`
- `GREATER_THAN`
- `GREATER_THAN_OR_EQUAL`
- `LESS_THAN`
- `LESS_THAN_OR_EQUAL`
- `BETWEEN`

Altre condizioni:

- tipo movimento;
- conto;
- categoria;
- intervallo date;
- giorno del mese;
- giorno della settimana.

La normalizzazione testuale è case-insensitive e accent-insensitive. La punteggiatura non viene rimossa automaticamente.

## Azioni Supportate

- assegna categoria;
- assegna conto;
- imposta tipo movimento solo tra entrata/uscita;
- normalizza descrizione;
- aggiungi nota.

Azioni non supportate:

- modifica importo;
- modifica data;
- elimina movimento;
- crea giroconto;
- crea prestito;
- crea ricorrenza;
- modifica saldo diretta.

## Priorità e Conflitti

Ordinamento:

1. `priority` crescente;
2. `created_at` crescente;
3. `id` crescente.

`stop_processing=true` interrompe la valutazione dopo la prima regola applicata.

Conflitti a pari priorità su campi incompatibili vengono rilevati e registrati come conflitti, senza affidarsi all’ordine casuale del database.

## Suggerimenti nel Form Movimento

Nel form “Nuovo movimento” viene chiamato `POST /api/automation/evaluate` con debounce.

Il suggerimento:

- non modifica automaticamente il form;
- mostra la regola trovata;
- mostra i campi suggeriti;
- permette “Applica suggerimento” o “Ignora”.

Non viene fatta una fetch per ogni carattere digitato.

## Applicazione Automatica

Durante `POST /api/transactions`:

1. il payload originale viene validato;
2. vengono caricate le regole attive dell’utente;
3. vengono applicate solo le regole con `apply_to_new_transactions=true`;
4. il payload risultante viene rivalidato;
5. la transazione viene salvata tramite `create_transaction_atomic`;
6. viene registrata l’applicazione automatica.

Se l’automazione fallisce, il movimento originale valido non viene bloccato inutilmente.

## Applicazione Massiva

Endpoint:

- `POST /api/automation/rules/[id]/preview`
- `POST /api/automation/rules/[id]/apply`

Limiti:

- massimo 20 esempi in preview;
- massimo 500 movimenti per batch;
- query filtrata per intervallo date;
- nessuna scansione completa non filtrata per bulk apply.

L’applicazione bulk usa `update_transaction_atomic`, quindi cambi conto/tipo/categoria restano coerenti con i saldi.

Strategia attuale: esecuzione parziale con report preciso. Ogni riga registra `APPLIED`, `SKIPPED`, `CONFLICT` o `FAILED`.

## Annullamento

Endpoint:

- `POST /api/automation/batches/[id]/revert`

L’annullamento ripristina automaticamente solo se i campi correnti coincidono ancora con `applied_values`. Se il movimento è stato modificato manualmente dopo il batch, viene rilevato conflitto e non viene sovrascritto.

## Registro

Tabella:

- `automation_rule_applications`

Registra:

- regola;
- movimento;
- batch;
- modalità;
- valori precedenti;
- valori applicati;
- esito;
- errore sicuro;
- data applicazione;
- data annullamento.

## Giroconti

Comportamento conservativo:

- i giroconti sono esclusi se la regola non contiene esplicitamente `transaction_type=transfer`;
- anche quando inclusi, non sono permesse azioni rischiose su conto, categoria o tipo;
- sono consentite solo azioni sicure come descrizione/nota.

L’atomicità dei giroconti non è stata modificata.

## Pagina

Percorso:

- `/automation`

Sezioni:

- KPI;
- regole attive/disattivate/archiviate;
- form nuova/modifica regola;
- preview;
- storico applicazioni.

Azioni UI:

- crea;
- modifica;
- duplica;
- attiva/disattiva;
- anteprima;
- prova;
- applica ai movimenti;
- archivia;
- elimina con conferma;
- annulla batch.

## API

Endpoint creati:

- `GET /api/automation/rules`
- `POST /api/automation/rules`
- `GET /api/automation/rules/[id]`
- `PATCH /api/automation/rules/[id]`
- `DELETE /api/automation/rules/[id]`
- `POST /api/automation/rules/[id]/preview`
- `POST /api/automation/rules/[id]/test`
- `POST /api/automation/rules/[id]/apply`
- `GET /api/automation/applications`
- `POST /api/automation/batches/[id]/revert`
- `POST /api/automation/evaluate`

Tutti gli endpoint sono autenticati, no-store e validati.

## Ricerca Globale

Integrazioni:

- comando “Apri Automazioni”;
- comando “Nuova regola”;
- comando “Storico automazioni”;
- ricerca remota per nome/descrizione regola.

## Backup & Restore

Export integrato:

- `automationRules`
- `automationApplicationBatches`
- `automationRuleApplications`

Record count, schema, normalizzazione, duplicate detection e relationship validation sono stati aggiornati.

Restore reale delle nuove tabelle è rinviato: richiede nuova RPC atomica di restore e validazione DB dedicata. Il dry-run considera le automazioni nello snapshot e un account con automazioni non è vuoto.

## Sicurezza

- Nessun service role nel browser.
- Nessuna AI o servizio esterno.
- RLS sulle nuove tabelle.
- Ownership verificata tramite RLS e `user_id`.
- Riferimenti conto/categoria verificati prima delle azioni.
- Giroconti protetti.
- Errori API sanitizzati.
- Regex non implementata nello Sprint 12 per evitare rischi di catastrophic backtracking.

## Performance

Limiti:

- 100 regole attive valutate per movimento;
- 10 condizioni per regola;
- 10 azioni per regola;
- 20 esempi preview;
- 500 movimenti per batch;
- storico paginato a 50/100 righe.

Query principali:

- pagina automazioni: 1 fetch principale (`GET /api/automation/rules`) più hook esistenti per conti/categorie;
- form movimento: endpoint debounced solo quando il draft è valutabile;
- bulk: una query movimenti filtrata per intervallo, più RPC atomica per righe applicate.

## Test

Aggiunti test unitari:

- matcher descrizione;
- accenti/case/spazi;
- importi in centesimi;
- condizioni tipo/conto/categoria/data;
- ALL/ANY;
- priorità;
- stop processing;
- conflitti;
- regole inattive/archiviate;
- protezione giroconti;
- riferimenti non validi;
- preview senza scrittura;
- diff valori precedenti/applicati.

## Limiti Noti

- REGEX rinviata.
- Restore reale delle nuove tabelle rinviato a sprint dedicato.
- UI bulk usa intervallo predefinito ultimi 90 giorni; filtri avanzati rinviati.
- Storico mostrato in forma compatta, senza tabella filtrabile avanzata.
- Indicatore “classificato da regola” nella lista movimenti rinviato.
- Test UI end-to-end non aggiunti perché il progetto usa principalmente Vitest unit/API.

## Migration

Migration creata localmente:

- `supabase/migrations/00019_automation_rules.sql`

Migration non applicata remotamente.
