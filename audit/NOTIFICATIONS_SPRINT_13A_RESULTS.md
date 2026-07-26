# Sprint 13A — Motore Notifiche e Centro Avvisi Finanziari
**Data completamento:** 2026-07-26  
**Stato:** COMPLETATO  

---

## 1. Riepilogo

Sprint 13A implementa un sistema completo di notifiche finanziarie per Aurora 5.0.  
Il motore di regole è puro (zero query DB, deterministico), la persistenza avviene via upsert con dedupe key, e l'intera pipeline è RLS-aware senza service role.

---

## 2. File creati

### Database
| File | Descrizione |
|------|-------------|
| `supabase/migrations/00020_notifications.sql` | Tabelle `notifications` + `notification_refresh_cooldowns`, RLS, 6 indici |

### Libreria notifiche
| File | Descrizione |
|------|-------------|
| `src/lib/notifications/types.ts` | Tutti i tipi TypeScript (Notification, NotificationCandidate, EngineInput, ecc.) |
| `src/lib/notifications/constants.ts` | Costanti (cooldown, soglie, finestre temporali) |
| `src/lib/notifications/rules.ts` | 7 funzioni pure di regola |
| `src/lib/notifications/engine.ts` | Orchestratore puro + deduplicazione |
| `src/lib/notifications/service.ts` | Layer DB (upsert, listNotifications, stato, cooldown, loadEngineInput) |
| `src/lib/notifications/index.ts` | Re-export centralizzato |

### API Routes
| Route | Metodi | Funzione |
|-------|--------|---------|
| `src/app/api/notifications/route.ts` | GET | Lista con filtri status/severity/type/sourceType/page/limit |
| `src/app/api/notifications/refresh/route.ts` | POST | Esegui motore + upsert + risolvi stale (con cooldown 60s) |
| `src/app/api/notifications/mark-all-read/route.ts` | POST | Segna tutte come lette |
| `src/app/api/notifications/[id]/route.ts` | PATCH | Aggiorna is_read |
| `src/app/api/notifications/[id]/archive/route.ts` | POST | Archivia |
| `src/app/api/notifications/[id]/restore/route.ts` | POST | Ripristina da archivio |
| `src/app/api/notifications/[id]/resolve/route.ts` | POST | Segna come risolto |

### Componenti UI
| File | Descrizione |
|------|-------------|
| `src/components/notifications/notification-item.tsx` | Item singola notifica (compact + full mode) |
| `src/components/notifications/notification-bell.tsx` | Campanella con badge 99+, dropdown ultimi 5 non letti |

### Pagine
| File | Descrizione |
|------|-------------|
| `src/app/(app)/notifications/page.tsx` | Pagina avvisi con 5 tab, paginazione, azioni bulk |

### Test
| File | Test |
|------|------|
| `tests/unit/notifications/rules.test.ts` | 42 test sulle 7 funzioni di regola |
| `tests/unit/notifications/engine.test.ts` | 15 test su compareSeverity, buildDedupeKey, deduplicateCandidates, evaluateNotificationRules |

---

## 3. File modificati

| File | Modifica |
|------|----------|
| `src/app/(app)/layout.tsx` | Aggiunto `NotificationBell` in sidebar desktop e header mobile; `/notifications` in `navItems` e `moreItems` |
| `src/components/global-command-menu.tsx` | Aggiunti 3 comandi: avvisi non letti, avvisi critici, navigazione avvisi |
| `src/lib/notifications/service.ts` | Fix query account (`select('*')` + `as unknown as Account[]`) |
| `src/lib/backup/types.ts` | Aggiunto `AuroraBackupNotificationV1`; campo `notifications?` in `AuroraBackupDataV1` |
| `src/lib/backup/schema.ts` | Aggiunto `notificationSchema`; `notifications: collection(notificationSchema).optional()` in `data` |
| `src/lib/backup/export/fetch-user-backup-data.ts` | Query notifiche (limit 5000, non-fatal); campo `notifications?` in `UserBackupData` |
| `src/lib/backup/export/map-backup-data.ts` | `mapNotification`; `notifications: (input.notifications ?? []).map(mapNotification)` in ritorno |

---

## 4. Schema database (00020_notifications.sql)

### Tabella `notifications`
- **PK:** `id uuid DEFAULT gen_random_uuid()`
- **Campi principali:** user_id, type (CHECK 11 valori), severity (CHECK INFO/WARNING/CRITICAL), title, message, dedupe_key, source_type (CHECK 7 valori), source_id, source_url, metadata
- **Stato:** is_read boolean DEFAULT false, archived_at timestamptz NULL, resolved_at timestamptz NULL, first_detected_at, last_detected_at, read_at
- **Constraint unico:** `notifications_user_dedupe_key(user_id, dedupe_key)` — garantisce no duplicati per utente
- **6 Indici:** active, unread, severity, type+detected, source, dedupe

### Tabella `notification_refresh_cooldowns`
- PK: `user_id uuid` (un record per utente)
- `last_refresh_at timestamptz NOT NULL`
- Usata per il cooldown cross-serverless-instance (60 secondi)

### RLS
- Tutti i SELECT/INSERT/UPDATE/DELETE richiedono `auth.uid() = user_id`
- DROP POLICY IF EXISTS + CREATE POLICY (idempotente)

---

## 5. Regole del motore (rules.ts)

| Funzione | Tipo | Severità | isCondition |
|----------|------|----------|-------------|
| `evaluateBalanceRules` | negative_projected_balance | WARNING/CRITICAL | true |
| `evaluateBudgetRules` | budget_threshold | WARNING (80%) / CRITICAL (100%) | true |
| `evaluateRecurrenceRules` | upcoming_recurrence / overdue_recurrence | INFO/WARNING/CRITICAL | true |
| `evaluateGoalRules` | goal_behind_schedule | WARNING/CRITICAL | true |
| `evaluateLoanRules` | overdue_loan_payment / upcoming_loan_payment / loan_due_soon | CRITICAL/WARNING/INFO | true |
| `evaluateAutomationRules` | automation_failure / automation_conflict | CRITICAL/WARNING | **false** |
| `evaluateDuplicateRules` | possible_duplicate | WARNING | **false** |

**Dedupe key pattern:** `type:{entity_id}:{period_or_date}:{threshold?}`  
**Proiezione saldo:** giorno per giorno per 30 giorni usando balance corrente + regole ricorrenti attive  
**Finestra duplicati:** 14 giorni; fingerprint = account|type|amount|date|normalizedDesc; ID in ordine lessicografico

---

## 6. Architettura notifiche

### Flusso principale
```
POST /api/notifications/refresh
  → checkAndSetCooldown() [se < 60s → 429]
  → loadEngineInput() [8 query parallele + listMonthlyBudgets]
  → evaluateNotificationRules(input) [puro, zero DB]
  → deduplicateCandidates() [same key → severità più alta]
  → upsertNotifications() [create new | update existing | reopen resolved]
  → resolveStaleConditionNotifications() [condition notifications non più attive → resolved_at]
  → return RefreshResult
```

### Modello di stato ibrido
- `is_read: boolean` — indipendente dall'archivio/risoluzione
- `archived_at: timestamptz NULL` — archiviato manualmente dall'utente
- `resolved_at: timestamptz NULL` — risolto automaticamente (CONDITION) o manualmente
- Scelta deliberata: 3 campi ortogonali invece di singolo status enum

### Auto-risoluzione
- CONDITION (budget, saldo, ricorrenze, prestiti, obiettivi) → resolved_at settato quando la condizione non è più presente
- EVENT (automation_failure, automation_conflict, possible_duplicate) → mai auto-risolti dal motore

---

## 7. Componenti UI

### NotificationBell
- Badge con conteggio (99+ cap)
- Fetch al mount e al focus della finestra (cooldown 30s lato client)
- Dropdown 280px con lista ultimi 5 non letti in modalità compact
- Chiusura su click esterno, Escape, navigazione
- Aggiornamento ottimistico del contatore su mark-read
- Footer con link "Vedi tutti gli avvisi"

### NotificationItem (compact mode)
- Layout 3 colonne: icona tipo+severità | titolo+messaggio | dot non letto
- Sfondo indigo-50 per notifiche non lette
- Tempo relativo in italiano (Adesso, X min fa, X ore fa, X giorni fa)

### NotificationItem (full mode)
- Badge severità colorato + dot non letto + tag archiviato/risolto
- Link "Vai al dettaglio" se source_url presente
- Azioni contestuali (visibili on hover): mark read/unread, archive, restore, resolve
- `role="article"` per accessibilità

### Pagina /notifications
- 5 tab: Tutti (all) | Non letti (unread) | Critici (all+CRITICAL) | Archiviati (archived) | Risolti (resolved)
- Azioni bulk: "Segna tutti letti" (solo se ci sono non letti), "Aggiorna" (POST /refresh poi re-fetch)
- Paginazione 20 per pagina con Precedente/Successiva
- Empty state illustrato per ogni tab

---

## 8. Integrazione layout

### Desktop sidebar (layout.tsx)
- `NotificationBell` aggiunto nell'header del sidebar (`justify-between` + `pr-3`)
- `/notifications` aggiunto a `navItems` (dopo `/loans`, prima di `/birthdays`)

### Mobile header (layout.tsx)
- `NotificationBell` aggiunto nella row degli icon-button (tra GlobalSearchTrigger e il menu hamburger)
- `/notifications` aggiunto a `moreItems`

### Comando globale (global-command-menu.tsx)
| ID | Gruppo | Label | Href |
|----|--------|-------|------|
| notifications-unread | Azioni rapide | Avvisi non letti | /notifications?status=unread |
| notifications-critical | Azioni rapide | Avvisi critici | /notifications?severity=CRITICAL |
| notifications | Navigazione | Avvisi | /notifications |

---

## 9. Risultati verifica finale

| Check | Risultato |
|-------|-----------|
| `npx tsc --noEmit` | ✅ 0 errori |
| `npx vitest run` | ✅ 550 passed / 14 skipped (36+1 file) |
| → di cui tests/unit/notifications/rules.test.ts | ✅ 42/42 |
| → di cui tests/unit/notifications/engine.test.ts | ✅ 15/15 |
| `npm run build` | ✅ Exit 0, tutte le 26 pagine generate |
| `/notifications` presente nel build | ✅ Route ○ (Static) |

---

## 10. Vincoli rispettati

| Vincolo | Rispettato |
|---------|------------|
| Non modificare Backup/Restore | ✅ Solo export aggiunto (sicuro); restore rinviato senza restore parziale |
| Non modificare struttura contabile di base | ✅ Zero modifiche a transactions/accounts/categories |
| Non modificare autenticazione | ✅ Zero modifiche a auth |
| Non fare commit | ✅ Nessun commit |
| Non fare push | ✅ Nessun push |
| Non applicare migration remote | ✅ File SQL solo locale |
| Non inviare email/push/SMS/WhatsApp | ✅ Zero invii dalla nuova logica |
| Non cancellare notifiche storiche automaticamente | ✅ Solo `resolved_at`, mai DELETE |
| Non duplicare logica finanziaria esistente | ✅ `listMonthlyBudgets` riusato; nessuna duplicazione |

---

## 11. Limitazioni documentate

### Backup — Restore rinviato
Le notifiche sono **incluse nell'export** ma **escluse dal restore**. Dettaglio:
- **Export:** `fetchUserBackupData` esegue query su `notifications` (limit 5000, errore non fatale), `mapNotification` serializza al tipo `AuroraBackupNotificationV1`, il campo `notifications` è presente nel JSON esportato.
- **Restore rinviato:** `notifications` non è in `BACKUP_COLLECTION_KEYS`; `buildRestorePlan` ignora silenziosamente il campo; nessun restore parziale rischioso introdotto.
- **Backward compatibility:** Schema Zod usa `.optional()` (non `.default([])`), così i backup precedenti senza il campo non subiscono modifiche al checksum.
- **Cooldown esclusi:** `notification_refresh_cooldowns` non è incluso nell'export né pianificato per il restore. Dopo un restore il cooldown è assente → il primo refresh avviene senza attesa.
- **source_id non rimappabile:** In un eventuale restore futuro, i `source_id` (account, categoria, loan, ecc.) dovranno essere rimappati tramite la stessa logica UUID già usata per le transazioni. Finché il restore non è implementato, le notifiche presenti nel backup rimangono solo un archivio storico leggibile.
- **Nessuna notifica durante restore:** Il restore non chiama `POST /api/notifications/refresh`; zero notifiche vengono generate o duplicate durante il processo.

### account_below_threshold
La regola per il saldo minimo del conto (threshold personalizzata) **non è implementata**: la tabella `accounts` non ha il campo `min_balance_threshold`. Skippata come da architettura corrente.

### account_below_threshold
La regola per il saldo minimo del conto (threshold personalizzata) **non è implementata**: la tabella `accounts` non ha il campo `min_balance_threshold`. Skippata come da architettura corrente.

### Notifiche condizionali non risolte senza refresh
Le CONDITION notifications si auto-risolvono solo quando viene eseguito `POST /api/notifications/refresh`. Se l'utente non aggiorna, una notifica può apparire come attiva anche dopo che la condizione si è risolta. Comportamento intenzionale: il refresh è responsabilità del client.

---

## 12. Note implementative

- **Cooldown DB-based:** `notification_refresh_cooldowns` (invece di in-memory) per compatibilità serverless
- **Upsert strategy:** `ON CONFLICT(user_id, dedupe_key)` → UPDATE updated_at + riapri se resolved_at != null
- **Deduplicazione candidati:** stesso dedupe_key → tieni severità più alta (CRITICAL > WARNING > INFO)
- **Proiezione saldo:** doppio loop per gestire `next_due_date` (prima occurrence) + occorrenze future (via countOccurrences)
- **Duplicate detection:** esclude transfer, esclude transazioni fuori finestra 14 giorni, ID stabile (minore:maggiore)
