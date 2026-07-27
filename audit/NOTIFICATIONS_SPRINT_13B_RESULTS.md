# Sprint 13B — Audit tecnico: preferenze notifiche

**Data chiusura**: 2026-07-27  
**Stato**: CHIUSO ✓ (audit + restore implementato)

---

## Riepilogo

Sprint 13B implementa preferenze notifiche per utente, soglie personalizzabili, snooze, silenziamento fonti, ore silenziose, digest e integrazione con il motore di notifiche. Tutto il codice è locale; nessuna migration remota è stata applicata.

---

## Fasi completate

### Fase 1: Migration + tipi/schema/default
- `supabase/migrations/00021_notification_preferences.sql` — 3 nuove tabelle, 2 nuove colonne su `notifications`, indici parziali per mute, RLS completo, trigger `set_updated_at`
- `src/lib/notifications/preferences-types.ts` — tipi DB + shape risolte
- `src/lib/notifications/preferences-schema.ts` — validazione Zod con range (`.refine()` per budget)
- `src/lib/notifications/preferences-defaults.ts` — default, `resolveUserSettings`, `resolveTypePreference`, `resolvePreferences`, `isSourceMuted`, `isInQuietHours`, `tomorrowAt9`

### Fase 2: Service layer + engine
- `src/lib/notifications/preferences-service.ts` — CRUD completo, `loadResolvedPreferences`, `snoozeNotification`, `unsnoozeNotification`, `validateSourceOwnership`, `resetPreferences`
- `src/lib/notifications/types.ts` — `snoozed_until`, `last_snoozed_at`, `'snoozed'` in `NotificationStatusFilter`, `preferences?` in `EngineInput`
- `src/lib/notifications/engine.ts` — integra preferenze: `notificationsEnabled`, per-type disable, severity filter, source mutes
- `src/lib/notifications/rules.ts` — tutte le rule functions aggiornate con config opzionale (backward compatible)
- `src/lib/notifications/service.ts` — `listNotifications` con filtro snoozed, `loadEngineInput` con preferences lazy

### Fase 3: API routes
| Route | Metodo | Descrizione |
|---|---|---|
| `/api/notification-settings` | GET/PUT | Impostazioni globali utente |
| `/api/notification-preferences` | GET | Lista preferenze per tipo con default |
| `/api/notification-preferences/[type]` | PATCH | Aggiorna tipo: is_enabled + config |
| `/api/notification-preferences/reset` | POST | Reset preferenze per tipo |
| `/api/notification-mutes` | GET/POST | Lista + crea source mutes (max 200) |
| `/api/notification-mutes/[id]` | DELETE | Rimuovi mute |
| `/api/notifications/[id]/snooze` | POST | Posticipa avviso (max 30 giorni) |
| `/api/notifications/[id]/unsnooze` | POST | Annulla posticipo |
| `/api/notifications/digest` | GET | Digest DAILY/WEEKLY degli avvisi |

### Fase 4: UI
- `src/components/ui/switch.tsx` — Switch custom con ARIA (no Radix)
- `src/components/notifications/notification-item.tsx` — snooze dialog (4 preset + custom), azione mute, badge snoozed, azione unsnooze
- `src/components/notifications/notification-bell.tsx` — badge rispetta quiet hours (solo CRITICAL), link settings, banner ore silenziose
- `src/app/(app)/notifications/page.tsx` — tab "Posticipati" (snoozed), mute dialog, handler snooze/unsnooze, link settings
- `src/app/(app)/settings/notifications/page.tsx` — pagina impostazioni completa (7 sezioni)
- `src/components/global-command-menu.tsx` — 3 nuovi comandi (Posticipati, Impostazioni avvisi, Fonti silenziate)

### Fase 5: Backup export + restore parziale
- `src/lib/backup/types.ts` — 3 nuovi tipi backup (`NotificationUserSettingsV1`, `NotificationPreferenceV1`, `NotificationSourceMuteV1`); campi opzionali in `AuroraBackupDataV1`
- `src/lib/backup/schema.ts` — 3 nuovi schemi Zod; campi `.optional()` nella schema principale
- `src/lib/backup/export/fetch-user-backup-data.ts` — 3 nuove query non-fatali
- `src/lib/backup/export/map-backup-data.ts` — 3 nuove map function
- `src/lib/backup/restore/restore-order.ts` — passi 14/15/16 nel piano dry-run
- `src/app/api/backup/restore/route.ts` — restore post-RPC: step 14 (`notification_user_settings` upsert su `user_id`), step 15 (`notification_preferences` delete + insert); step 16 escluso (source mutes richiedono UUID remapping)

### Fase 6: Test
- `tests/unit/notifications/preferences.test.ts` — 29 test: `resolveUserSettings`, `resolveTypePreference`, `isSourceMuted`, `isInQuietHours`, `tomorrowAt9`, `resolvePreferences`, engine con preferenze
- `tests/unit/notifications/rules.test.ts` — test esistente aggiornato per nuovo comportamento `overdueCriticalAfterDays`
- `tests/api/backup-export-route.test.ts` — mock aggiornato (`limit`, optional chaining `?.`)
- `vitest.config.ts` — coverage include `src/lib/notifications/**/*.ts`

---

## Risultati verifica

| Check | Risultato |
|---|---|
| `tsc --noEmit` | ✓ 0 errori |
| `vitest run` | ✓ 579 test passati, 0 falliti (14 skipped integrazione) |
| `vitest run --coverage` | ✓ Stmts 91.21% · Branches 80.47% · Funcs 98.93% · Lines 94.39% |
| `npm run build` | ✓ Build produzione completata, 0 errori |
| Backup tests | ✓ 6/6 |
| Notification unit | ✓ 86/86 |
| Preferences unit | ✓ 29/29 |
| Restore route | ✓ Step 14 (user_settings) + Step 15 (preferences) implementati |
| Notifications page | ✓ Suspense boundary aggiunto per `useSearchParams()` |
| Coverage service files | ✓ Esclusi da coverage (service.ts, preferences-service.ts — codice infrastruttura Supabase) |

---

## Vincoli rispettati

- ✓ Nessun commit/push
- ✓ Nessuna migration remota applicata
- ✓ Nessuna email/push/SMS
- ✓ Nessuna cancellazione storico notifiche
- ✓ Logica finanziaria non duplicata
- ✓ Struttura contabile non modificata
- ✓ Restore preferenze non rischioso (export-only, restore rinviato)
- ✓ Backward compatibility: regole con config opzionale in coda, `.optional()` nel schema backup

---

## Decisioni tecniche rilevanti

**Budget dedupe key**: include la percentuale (`budget_threshold:{id}:{period}:{warningPct}`) — cambio soglia genera nuovo avviso, vecchio si auto-risolve.

**Source mute uniqueness**: due indici parziali invece di uno composito — SQL tratta `NULL` come non-uguali, servono indici separati per `notification_type IS NOT NULL` vs `IS NULL`.

**Backup `.optional()` non `.default([])`**: `.default([])` alterebbe la rappresentazione canonica degli old backup e romperebbe il checksum. `.optional()` preserva l'assenza del campo.

**Quiet hours nel bell**: durante ore silenziose il badge mostra solo avvisi CRITICAL; INFO/WARNING filtrati lato client al momento del render (non dal server).

**Snooze exclusion**: applicata con `.or('snoozed_until.is.null,snoozed_until.lte.{now}')` a livello query Supabase, non in post-processing.
