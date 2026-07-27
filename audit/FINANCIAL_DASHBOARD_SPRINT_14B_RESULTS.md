# Sprint 14B - Dashboard finanziaria avanzata

## Obiettivo

La dashboard autenticata di Aurora e stata trasformata in una panoramica finanziaria avanzata, personalizzabile e collegata al motore Financial Health introdotto nello Sprint 14A.

La dashboard non ricalcola score, metriche finanziarie o interpretazioni lato client. Usa il payload di `GET /api/financial-health` come sorgente principale e visualizza dati gia prodotti dal motore deterministico.

## File creati

- `src/lib/dashboard/types.ts`
- `src/lib/dashboard/widget-registry.ts`
- `src/lib/dashboard/preferences.ts`
- `src/lib/dashboard/helpers.ts`
- `src/app/api/dashboard/preferences/route.ts`
- `src/app/api/dashboard/preferences/reset/route.ts`
- `src/components/dashboard/dashboard-preferences-dialog.tsx`
- `src/components/dashboard/dashboard-widgets.tsx`
- `supabase/migrations/00023_dashboard_preferences.sql`
- `tests/unit/dashboard/preferences.test.ts`
- `tests/unit/dashboard/helpers.test.ts`
- `tests/api/dashboard-preferences-route.test.ts`
- `audit/FINANCIAL_DASHBOARD_SPRINT_14B_RESULTS.md`

## File modificati

- `src/app/(app)/dashboard/page.tsx`
- `src/lib/financial-health/types.ts`
- `src/lib/financial-health/service.ts`
- `src/lib/financial-health/engine.ts`
- `src/app/api/backup/restore/route.ts`
- `src/lib/backup/types.ts`
- `src/lib/backup/schema.ts`
- `src/lib/backup/export/fetch-user-backup-data.ts`
- `src/lib/backup/export/map-backup-data.ts`
- `src/lib/backup/restore/restore-order.ts`
- `src/types/database.ts`
- `src/components/global-command-menu.tsx`
- `tests/unit/financial-health/engine.test.ts`
- `vitest.config.ts`

## Migliorie introdotte

- Nuova dashboard unica su `/dashboard`, non duplicata.
- Header con saluto, periodo, data, ultimo calcolo, qualita dati e stato provvisorio.
- Selettore periodo compatibile con l'API Financial Health: mese corrente e mese precedente.
- Widget registry centralizzato con ID, label, descrizione, visibilita default, ordine e priorita mobile.
- Preferenze dashboard persistite in `dashboard_preferences`.
- Dialog di personalizzazione con show/hide, riordino semplice e reset.
- Widget per:
  - indicatori principali;
  - salute finanziaria;
  - componenti dello score;
  - saldo previsionale;
  - entrate, uscite e margine;
  - copertura spese;
  - budget a rischio;
  - scadenze;
  - prestiti;
  - obiettivi;
  - azioni consigliate;
  - avvisi prioritari;
  - storico score.
- Backup export include `dashboardPreferences` come sezione opzionale.
- Restore ripristina le preferenze dashboard con upsert non fatale e validazione dei widget noti.
- Command menu aggiornato con personalizzazione dashboard e aggiornamento panoramica.

## Vincoli rispettati

- Nessuna modifica alla logica contabile.
- Nessuna modifica ad `AppTransaction`.
- Nessuna modifica a calcoli di saldo o movimenti.
- Nessun uso di AI/LLM.
- Nessun cron.
- Nessuna modifica automatica ai dati finanziari.
- Nessun calcolo client-side dello score Financial Health.
- Nessun duplicate engine.
- Nessuna migration applicata a Supabase remoto.
- Nessun commit.
- Nessun push.

## Limiti intenzionali

- Il selettore periodo espone solo mese corrente e mese precedente, perche sono i periodi supportati in modo nativo e sicuro dall'API Financial Health.
- Le liste budget/scadenze/prestiti/obiettivi sono focus prioritari sintetici, non sostituiscono le pagine verticali dedicate.
- La preferenza dashboard e opzionale nel formato backup: i backup precedenti restano validi.

## Test aggiunti

- Registry widget: unicita, ordine, descrizioni.
- Preferenze dashboard: normalizzazione, scarto widget sconosciuti, deduplica, reset, serializzazione DB.
- Helper dashboard: periodo, percentuali, trend, deduplica, storico score.
- API preferenze dashboard: autenticazione, default, validazione payload, upsert user-scoped.
- Engine Financial Health: payload dashboard-ready derivato dal motore.

## Verifiche

- `npx tsc --noEmit`: superato.
- `npx vitest run`: 626 test passati, 14 skipped, 0 failed.
- `npm run test:coverage`: superato.
  - Coverage globale: statements 93.21%, branches 82.47%, functions 97.6%, lines 95.49%.
  - Coverage `src/lib/dashboard`: statements 96.7%, branches 94.02%, functions 100%, lines 98.59%.
- `npm run build`: superato.
- `git diff --check`: da eseguire come ultimo controllo.
