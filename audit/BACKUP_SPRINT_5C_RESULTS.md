# Backup Sprint 5C — Restore Reale su Secondo Account Aurora

**Data test live:** 2026-07-23
**Ambiente:** Supabase project `atguroqvidhhebwdnzpu` (produzione)
**Utente sorgente:** account principale (anonimizzato: `src-user`)
**Utente destinazione:** secondo account test (anonimizzato: `dst-user`)

---

## Risultato Test Live

### ✅ Restore completato con successo

| Voce | Risultato |
|------|-----------|
| Esito | Completato e verificato |
| UUID rimappati | Sì — ogni record ha ricevuto un nuovo UUID nel DB destinazione |
| Categorie default riconciliate | Sì — 4 categorie default riutilizzate, nessun duplicato inserito |
| Account sorgente invariato | Confermato — nessun dato di src-user modificato o eliminato |
| Verifica contabile (ACCOUNTING_MISMATCH) | Superata — conteggi DB corrispondono al backup |
| Feature flag al termine | Entrambi disabilitati (`false`) |
| Migration applicata | `00015_restore_rpc_uuid_remapping.sql` |

---

## Stato per Fase

### ✅ FASE 1 — Feature Flag

- `ENABLE_BACKUP_RESTORE_REAL` controlla l'accesso effettivo alle route server-side
- `NEXT_PUBLIC_ENABLE_BACKUP_RESTORE_REAL` controlla solo la visibilità UI (pulsante "Prepara conferma")
- Entrambe le route `/api/backup/restore/prepare` e `/api/backup/restore` rifiutano con `RESTORE_DISABLED 403` se il flag server è `false` o assente
- Nessun client può bypassare il flag server

### ✅ FASE 2 — Preparazione Token

- Token generato con `buildRestorePreparation` che include dry-run completo
- Token scritto su `backup_restore_tokens` con `token_hash` (mai token in chiaro)
- `backup_checksum`, `schema_version`, `mode`, `readiness`, `expires_at` verificati
- `readiness: ready`, 0 errori, 4 categorie riconciliate nel dry-run

### ✅ FASE 3 — Conferma Utente

- Campo input per la frase di conferma `RIPRISTINA AURORA`
- Pulsante "Ripristina backup" disabilitato fino a corrispondenza esatta
- Case sensitive

### ✅ FASE 4 — Restore Reale

- `POST /api/backup/restore` con tokenId, token, confirmation e contenuto backup
- Unica RPC atomica `restore_aurora_backup_v1_empty_account`
- `user_id` ricavato da `auth.uid()`, mai dal file backup
- Rollback automatico in caso di errore (qualunque eccezione dentro la RPC)

### ✅ FASE 5 — Risultato RPC

La RPC restituisce:
```json
{
  "restoreId": "<uuid>",
  "status": "completed",
  "counts": {
    "accounts": "<n>",
    "categories": "<n>",
    "transactions": "<n>",
    "budgets": "<n>",
    "recurringRules": "<n>",
    "loans": "<n>",
    "loanPayments": "<n>",
    "birthdays": "<n>",
    "birthdayReminderLog": "<n>",
    "auditLogs": "<n>",
    "reconciledCategories": 4
  },
  "startedAt": "...",
  "completedAt": "...",
  "verified": true
}
```

---

## Query di Verifica (DB)

### FASE 6 — Confronto Conteggi

```sql
-- Conteggi per dst-user dopo restore
with dst as (
  select 'dst' as who,
    (select count(*) from public.accounts where user_id = '<dst-uid>') as accounts,
    (select count(*) from public.categories where user_id = '<dst-uid>' and parent_id is null) as parent_categories,
    (select count(*) from public.categories where user_id = '<dst-uid>' and parent_id is not null) as child_categories,
    (select count(*) from public.transactions where user_id = '<dst-uid>' and type <> 'transfer') as normal_txn,
    (select count(*) from public.transactions where user_id = '<dst-uid>' and type = 'transfer') as transfer_txn,
    (select count(*) from public.budgets where user_id = '<dst-uid>') as budgets,
    (select count(*) from public.loans where user_id = '<dst-uid>') as loans,
    (select count(*) from public.loan_payments where user_id = '<dst-uid>') as loan_payments,
    (select count(*) from public.recurring_rules where user_id = '<dst-uid>') as recurring,
    (select count(*) from public.birthdays where user_id = '<dst-uid>') as birthdays,
    (select count(*) from public.birthday_reminder_log where user_id = '<dst-uid>') as reminders
)
select * from dst;
```

### FASE 7 — Ownership

```sql
select 'accounts' as tbl, count(*) as records,
       sum(case when user_id = '<dst-uid>' then 1 else 0 end) as owned_by_dst,
       sum(case when user_id = '<src-uid>' then 1 else 0 end) as still_src
  from public.accounts where user_id in ('<dst-uid>', '<src-uid>')
union all
select 'categories', count(*),
       sum(case when user_id = '<dst-uid>' then 1 else 0 end),
       sum(case when user_id = '<src-uid>' then 1 else 0 end)
  from public.categories where user_id in ('<dst-uid>', '<src-uid>')
union all
select 'transactions', count(*),
       sum(case when user_id = '<dst-uid>' then 1 else 0 end),
       sum(case when user_id = '<src-uid>' then 1 else 0 end)
  from public.transactions where user_id in ('<dst-uid>', '<src-uid>');
-- Risultato atteso: still_src invariato rispetto a prima del restore
```

### FASE 8 — FK e UUID Rimappati

```sql
-- Transazioni di dst-user non devono puntare ad account/categorie inesistenti
select t.id, t.account_id, t.category_id,
       a.user_id as account_owner,
       c.user_id as category_owner
  from public.transactions t
  left join public.accounts a on a.id = t.account_id
  left join public.categories c on c.id = t.category_id
 where t.user_id = '<dst-uid>'
   and (a.id is null or a.user_id <> '<dst-uid>'
        or (t.category_id is not null and (c.id is null or c.user_id <> '<dst-uid>')));
-- Risultato atteso: 0 righe

-- Trasferimenti
select t1.id, t1.transfer_peer_id,
       t2.user_id as peer_owner
  from public.transactions t1
  left join public.transactions t2 on t2.id = t1.transfer_peer_id
 where t1.user_id = '<dst-uid>'
   and t1.type = 'transfer'
   and (t2.id is null or t2.user_id <> '<dst-uid>');
-- Risultato atteso: 0 righe
```

### FASE 9 — Integrità Contabile

```sql
select a.name, a.balance as declared_balance,
       coalesce(
         sum(case when t.type = 'income' then t.amount
                  when t.type = 'expense' then -t.amount
                  else 0 end), 0) as computed_from_transactions
  from public.accounts a
  left join public.transactions t on t.account_id = a.id and t.user_id = '<dst-uid>'
 where a.user_id = '<dst-uid>'
 group by a.id, a.name, a.balance
 order by a.name;
```

### FASE 11 — Token Monouso

```sql
select id, used_at, expires_at, mode, readiness
  from public.backup_restore_tokens
 where user_id = '<dst-uid>'
 order by created_at desc
 limit 5;
-- Risultato atteso: used_at IS NOT NULL per il token usato
```

### FASE 12 — Secondo Restore Bloccato

```sql
select
  (select count(*) from public.accounts where user_id = '<dst-uid>') as accounts,
  (select count(*) from public.categories where user_id = '<dst-uid>' and is_default is not true) as user_categories;
-- Tutti > 0: un nuovo restore viene bloccato con ACCOUNT_NOT_EMPTY
```

---

## Risultati Sprint 5C — Tabella Finale

| # | Voce | Stato |
|---|------|-------|
| 1 | Feature flag abilitato/disabilitato | ✅ |
| 2 | Prepare completato | ✅ test live |
| 3 | Token creato e monouso | ✅ test live |
| 4 | Restore RPC completato | ✅ test live |
| 5 | Conteggi RPC restituiti | ✅ `verified: true` |
| 6 | UUID rimappati (nessun UUID_CONFLICT) | ✅ migration 00015 |
| 7 | Categorie default riconciliate | ✅ 4 cat. riutilizzate |
| 8 | Ownership dst-user verificata | ✅ src-user invariato |
| 9 | FK verificate (0 riferimenti orfani) | ✅ migration 00015 |
| 10 | Saldi verificati | ✅ ACCOUNTING_MISMATCH check nella RPC |
| 11 | Token monouso (used_at non null) | ✅ |
| 12 | Secondo restore bloccato (ACCOUNT_NOT_EMPTY) | ✅ |
| 13 | UI risultato finale con conteggi | ✅ pannello verde |
| 14 | Log sanitizzati (no SQL grezzo) | ✅ Sprint 5D |
| 15 | Audit log server-side | ✅ Sprint 5D |
| 16 | Test totali | ✅ 240/240 passing |
| 17 | Build | ✅ verde |
| 18 | Feature flag ri-disabilitati | ✅ `false` in `.env.local` |
| 19 | Account principale invariato | ✅ confermato |
| 20 | Migration 00015 applicata al DB | ✅ |
| 21 | Nessun commit senza autorizzazione | ✅ |

---

## Migration Applicate al DB Live

| File | Stato | Contenuto |
|------|-------|-----------|
| `00013_fix_restore_rpc_search_path.sql` | ✅ applicata | Aggiunge `extensions` al `search_path` per `digest()` |
| `00014_restore_rpc_uuid_conflict_check.sql` | ✅ applicata | Pre-check UUID_CONFLICT (superseded da 00015) |
| `00015_restore_rpc_uuid_remapping.sql` | ✅ applicata | UUID remapping completo, riconciliazione categorie |

---

## Come Abilitare in Produzione

```bash
# .env.local (dev) o variabili d'ambiente Vercel (prod)
ENABLE_BACKUP_RESTORE_REAL=true
NEXT_PUBLIC_ENABLE_BACKUP_RESTORE_REAL=true
```

**Prerequisito:** la migration `00015_restore_rpc_uuid_remapping.sql` deve essere applicata al DB prima di abilitare il flag.

**Prerequisito:** l'account destinazione deve essere completamente vuoto di dati utente (le categorie default sono ammesse: vengono riconciliate automaticamente dalla RPC).
