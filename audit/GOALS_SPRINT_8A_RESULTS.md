# Sprint 8A - Obiettivi di Risparmio

## Sintesi

Lo sprint introduce il sistema "Obiettivi di risparmio" come modulo indipendente dalla contabilità. Gli obiettivi hanno un target, un importo accumulato e uno storico di versamenti. I versamenti aggiornano `current_amount` con logica server-side tramite trigger PostgreSQL e non modificano mai i saldi dei conti.

## Schema

Migration creata:

- `supabase/migrations/00017_savings_goals.sql`

Tabelle:

- `savings_goals`
- `goal_contributions`

Vincoli principali:

- `target_amount > 0`
- `current_amount >= 0`
- `amount > 0` sui versamenti
- `status in ('ACTIVE', 'COMPLETED', 'ARCHIVED')`

## RLS

RLS abilitata su entrambe le tabelle.

Policy:

- select/insert/update/delete per soli record del proprietario su `savings_goals`
- select/insert/delete per soli record del proprietario su `goal_contributions`
- insert contribution consentito solo se l'obiettivo appartiene all'utente autenticato

## Logica Server-Side

Trigger:

- `set_savings_goal_status`
- `apply_goal_contribution_insert`
- `apply_goal_contribution_delete`

I trigger:

- aggiornano `updated_at`
- marcano automaticamente completato un goal quando `current_amount >= target_amount`
- marcano archiviato se `archived = true`
- incrementano/decrementano `current_amount` quando un versamento viene inserito o eliminato

## Service

Creato:

- `src/lib/goals/service.ts`

Funzioni:

- `listGoals`
- `createGoal`
- `updateGoal`
- `archiveGoal`
- `deleteGoal`
- `addContribution`
- `deleteContribution`
- `buildGoalSummary`
- `getGoalDetail`
- `getGoalsSummary`

Le funzioni separano query, normalizzazione e calcoli. Il dettaglio carica al massimo 50 versamenti.

## API

Endpoint creati:

- `GET /api/goals`
- `POST /api/goals`
- `GET /api/goals/[id]`
- `PATCH /api/goals/[id]`
- `DELETE /api/goals/[id]`
- `POST /api/goals/[id]/contributions`
- `DELETE /api/goals/contributions/[id]`

Tutte le response usano `Cache-Control: no-store`.

Errori gestiti:

- `GOAL_NOT_FOUND`
- `INVALID_AMOUNT`
- `UNAUTHORIZED`
- `INVALID_STATUS`
- `INVALID_ID`

## UI

Pagine create:

- `/goals`
- `/goals/[id]`

Funzionalità:

- elenco obiettivi attivi, completati e archiviati
- card con target, accumulato, residuo, percentuale e barra avanzamento
- creazione, modifica, archiviazione, eliminazione
- versamento rapido
- dettaglio con grafico, storico versamenti e cancellazione versamento
- loading, empty state, error toast e responsive

## Dashboard

`DashboardService` ora include `goalsSummary` dentro il payload di `GET /api/dashboard`.

La dashboard continua a usare una sola fetch: `/api/dashboard`.

La UI mostra una card "Obiettivi di risparmio" con:

- target totale
- importo accumulato
- residuo
- percentuale complessiva
- obiettivo più vicino

## Test

Test aggiunti:

- `tests/unit/goals/service.test.ts`
- `tests/unit/goals/migration-static.test.ts`
- `tests/api/goals-route.test.ts`

Casi coperti:

- summary dashboard goals
- percentuali oltre 100%
- ordinamento e normalizzazione goals
- dettaglio e contributi
- presenza vincoli/RLS nella migration
- trigger server-side di aggiornamento `current_amount`
- API auth, validazione importi, UUID e no-store

## Limiti

- I test RLS sono statici perché l'ambiente locale Docker/Supabase non è garantito su questa macchina.
- Non è stata eseguita una validazione DB reale della migration.
- Gli obiettivi sono volutamente indipendenti dai conti: non esiste collegamento con movimenti o saldi.

## Decisioni Progettuali

- Nessuna modifica a Backup/Restore, Budget, Ricorrenze, Prestiti, Importazioni o Auth.
- Nessuna nuova dipendenza.
- Nessuna modifica al motore contabile.
- L'archiviazione è soft tramite `archived/status`; l'eliminazione è reale e cancella anche i versamenti via FK cascade.
