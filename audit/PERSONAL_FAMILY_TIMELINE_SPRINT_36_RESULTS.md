# Sprint 36 - Timeline personale e familiare

## Obiettivo

Sprint 36 introduce una Timeline privata per eventi personali e familiari importanti. Il modulo e' separato dalla contabilita': non crea movimenti, non modifica saldi, non influenza patrimonio, budget, report, Financial Health o assistente finanziario.

## Analisi iniziale

Il progetto disponeva gia' di moduli privati protetti lato server, in particolare Scadenze personali e Ferie/Permessi. La Timeline riusa gli stessi principi:

- accesso server-side tramite permesso HR privato;
- RLS per utente;
- API server con `supabase.auth.getUser()`;
- nessun uso di service role nel browser;
- backup/restore con dati privati esportati solo per account autorizzato.

## Schema scelto

Nuova tabella locale:

- `public.personal_timeline_events`

Campi principali:

- `user_id`
- `event_date`
- `end_date`
- `title`
- `description`
- `category`
- `subject`
- `location`
- `provider`
- `tags`
- `importance`
- `created_at`
- `updated_at`

Constraint principali:

- titolo non vuoto;
- `end_date >= event_date` quando `end_date` e' presente;
- categorie ammesse: `HEALTH`, `THERAPY`, `SCHOOL`, `DOCUMENT`, `ADMINISTRATIVE`, `TRAVEL`, `FAMILY`, `MILESTONE`, `OTHER`;
- soggetti ammessi: `SELF`, `AURORA`, `ILENIA`, `FAMILY`;
- importanza ammessa: `LOW`, `NORMAL`, `HIGH`.

La migration e' pensata per essere rieseguibile localmente: usa `create table if not exists`, `add column if not exists`, `drop policy if exists`, `drop trigger if exists`, `create index if not exists` e blocchi `DO` per constraint nominati.

## Accesso e privacy

La pagina `/timeline` e le API `/api/timeline` e `/api/timeline/[id]` sono disponibili solo all'account HR privato autorizzato. Gli utenti non autorizzati ricevono 403 e non vedono la voce in navigazione o command menu.

RLS usa `auth.uid() = user_id` per lettura e scrittura. Le API filtrano sempre anche per `user_id` lato server.

## UI

La pagina Timeline include:

- header con CTA "Nuovo evento";
- KPI sintetici;
- filtri per soggetto, categoria, anno e ricerca;
- lista cronologica inversa;
- raggruppamento per anno e mese;
- paginazione "Carica altri";
- dettaglio evento;
- form crea/modifica;
- dialog di conferma eliminazione;
- loading, errore ed empty state.

## Backup e restore

Il backup include `personalTimelineEvents` solo per account HR privato autorizzato. Il campo `user_id` non viene esportato.

Il restore:

- blocca backup con Timeline per account non autorizzati;
- ripristina gli eventi con `user_id` dell'utente autenticato;
- considera Timeline nella verifica di account vuoto;
- include collisioni ID e duplicati logici tramite fingerprint conservativo.

## Test creati o aggiornati

Creati:

- `tests/unit/timeline/timeline.test.ts`
- `tests/unit/timeline/migration-static.test.ts`
- `tests/api/timeline-route.test.ts`

Aggiornati:

- `tests/unit/access/private-finance-navigation.test.ts`
- `tests/unit/backup/backup-export.test.ts`
- `tests/api/backup-restore-route.test.ts`

Casi coperti:

- validazione date e intervalli;
- normalizzazione tag;
- ordinamento e raggruppamento;
- statistiche;
- fingerprint logico;
- filtri;
- migration statica, RLS, policy e trigger;
- API non autenticata, non autorizzata e autorizzata;
- creazione, modifica, eliminazione;
- accesso nav/command menu;
- export backup senza `user_id`;
- restore autorizzato e blocco restore non autorizzato.

## Limiti residui

- Nessun allegato.
- Nessuna importazione automatica.
- Nessuna AI.
- Nessuna notifica automatica dedicata alla Timeline.
- La migration non e' stata applicata a database remoto in questo sprint.

## Verifiche

Da eseguire a chiusura sprint:

- `npx tsc --noEmit`
- test mirati Timeline/API/backup
- `npx vitest run`
- `npm run test:coverage`
- `npm run build`
- `git diff --check`

## Conferme

- Nessun dato finanziario modificato.
- Nessuna logica contabile modificata.
- Nessun provider AI introdotto.
- Nessun allegato introdotto.
- Nessuna migration remota applicata.
- Nessun commit.
- Nessun push.
- Nessun deploy.
