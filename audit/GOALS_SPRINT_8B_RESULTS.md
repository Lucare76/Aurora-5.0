# Sprint 8B - Obiettivi di Risparmio Intelligenti

## Sintesi

Sprint 8B estende gli obiettivi di risparmio introdotti nello Sprint 8A con calcoli deterministici, forecast, ritmo necessario, stati intelligenti, storico mensile, insight e riepilogo dashboard. Gli obiettivi restano indipendenti dalla contabilità: nessun saldo conto, movimento contabile, import/export o backup/restore è stato modificato.

## Funzionalità Implementate

- Previsione data completamento.
- Importo mensile e settimanale necessario per rispettare la scadenza.
- Confronto tra avanzamento reale e avanzamento atteso.
- Stato intelligente derivato, non persistito.
- Storico mensile ultimi 12 mesi con mesi vuoti.
- Insight deterministici massimo 3 per obiettivo.
- Riepilogo dashboard esteso senza nuove fetch client.
- Miglioramento automatico della regola `COMPLETED -> ACTIVE` quando un versamento eliminato riporta sotto target.

## File Creati

- `supabase/migrations/00018_savings_goals_intelligence_status.sql`
- `audit/GOALS_SPRINT_8B_RESULTS.md`

## File Modificati

- `src/lib/goals/service.ts`
- `src/app/(app)/goals/page.tsx`
- `src/app/(app)/goals/[id]/page.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `tests/unit/goals/service.test.ts`
- `tests/unit/goals/migration-static.test.ts`
- `tests/api/goals-route.test.ts`

## Formule

`remainingAmount = max(targetAmount - currentAmount, 0)`

`completionPercentage = round(currentAmount / targetAmount * 100)`

`activeDays = todayUtc - firstContributionDate`

`activeMonths = activeDays / 30.4375`

`averageMonthlyContribution = totalContributed / activeMonths`

`averageContributionAmount = totalContributed / contributionCount`

`estimatedMonthsRemaining = remainingAmount / averageMonthlyContribution`

`estimatedCompletionDate = today + ceil(estimatedMonthsRemaining * 30.4375 giorni)`

`requiredMonthlyContribution = remainingAmount / (daysRemaining / 30.4375)`

`requiredWeeklyContribution = requiredMonthlyContribution / (30.4375 / 7)`

`expectedProgressPercentage = elapsedDaysFromGoalCreationToToday / totalDaysFromGoalCreationToTargetDate * 100`

`paceDifferencePercentage = actualProgressPercentage - expectedProgressPercentage`

`projectedAmountAtDeadline = currentAmount + averageMonthlyContribution * monthsRemaining`

`projectedShortfall = max(targetAmount - projectedAmountAtDeadline, 0)`

`projectedSurplus = max(projectedAmountAtDeadline - targetAmount, 0)`

## Regola `hasEnoughData`

Una previsione è affidabile solo se:

- almeno 2 versamenti;
- distribuiti su almeno 14 giorni;
- media mensile maggiore di 0.

Con dati insufficienti:

- `forecastStatus = INSUFFICIENT_DATA` oppure `ZERO_PACE`;
- non viene generata una data stimata;
- la UI mostra che servono altri versamenti.

## Stati Intelligenti

Lo stato intelligente è derivato dal service e non viene salvato nel database.

- `COMPLETED`: `currentAmount >= targetAmount`
- `OVERDUE`: scadenza superata e obiettivo non completato
- `AHEAD`: almeno +10 punti percentuali rispetto al ritmo atteso
- `ON_TRACK`: da -5 a +10 punti
- `SLIGHTLY_BEHIND`: da -15 a -5 punti
- `BEHIND`: sotto -15 punti
- `NO_DEADLINE`: obiettivo senza scadenza con dati sufficienti
- `INSUFFICIENT_DATA`: dati insufficienti

## Insight

Gli insight sono deterministici, ordinati per severità e priorità, massimo 3.

Severity:

- `DANGER`
- `WARNING`
- `SUCCESS`
- `INFO`

Esempi implementati:

- obiettivo completato;
- obiettivo scaduto;
- in anticipo/in linea/in ritardo;
- quota mensile necessaria;
- previsione disponibile;
- dati insufficienti;
- nessun versamento recente;
- quasi completato;
- accelerazione/rallentamento;
- streak di versamenti.

## Completamento Automatico

Migration:

- `00018_savings_goals_intelligence_status.sql`

Regola:

- se `archived = true` o lo stato precedente è `ARCHIVED`, resta `ARCHIVED`;
- se `current_amount >= target_amount`, diventa `COMPLETED`;
- se era `COMPLETED` e `current_amount < target_amount`, torna `ACTIVE`.

Questa scelta è la meno invasiva perché lo schema non distingue completamento manuale e automatico.

## API

`GET /api/goals` continua a restituire `data`, ma ogni obiettivo ora include anche:

- `intelligentStatus`
- `forecast`
- `pace`
- `estimatedCompletionDate`
- `requiredMonthlyContribution`
- `primaryInsight`

`GET /api/goals/[id]` mantiene compatibilità e aggiunge:

- `summary`
- `forecast`
- `pace`
- `history`
- `insights`

`Cache-Control: no-store` invariato.

## Dashboard

`goalsSummary` in `GET /api/dashboard` ora include:

- `goalsOnTrack`
- `goalsBehind`
- `overdueGoals`
- `nearestDeadlineGoal`
- `nearestCompletionGoal`
- `totalRequiredMonthlyContribution`
- `primaryGoalsInsight`

La dashboard continua a usare una sola fetch client: `/api/dashboard`.

## Query e Performance

Lista obiettivi:

- 1 query per goals;
- 1 query batch per contributions di tutti i goals caricati;
- nessun N+1.

Dettaglio:

- 1 query goal;
- 1 query ultimi 50 versamenti;
- 1 query versamenti aggregabili per forecast/history;
- nessun N+1.

Dashboard:

- nessuna nuova fetch client;
- il riepilogo resta dentro `GET /api/dashboard`;
- per evitare carichi eccessivi dashboard usa i dati leggeri dei goals già caricati nel service.

## Casi Limite Gestiti

- nessun versamento;
- un solo versamento;
- dati insufficienti;
- obiettivo completato;
- scadenza futura, odierna, superata;
- obiettivo senza scadenza;
- percentuali oltre 100%;
- mesi senza versamenti nello storico;
- trend insufficiente;
- eliminazione versamento dopo completamento.

## Test

Aggiunti/aggiornati test per:

- forecast con dati insufficienti;
- forecast con più versamenti;
- calcolo quota mensile;
- stati intelligenti;
- storico 12 mesi;
- trend/insight;
- payload detail compatibile;
- migration status `COMPLETED -> ACTIVE`;
- API mock con query batch.

## Limiti

- La validazione RLS reale richiede Supabase locale/staging; qui resta coperta da test statici e test API mockati.
- La dashboard non carica lo storico completo dei versamenti per mantenere il requisito di leggerezza.
- La data effettiva di completamento viene mostrata solo se ricavabile in modo affidabile dai contributi disponibili; non viene inventata.

## Verifiche

Eseguite:

- `npx tsc --noEmit`
- `npx vitest run`

Da completare nella fase finale:

- `npm run test:coverage`
- `npm run build`
- `git diff --check`
