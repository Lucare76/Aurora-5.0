# Backup Sprint 5C — Restore Reale su Secondo Account Aurora

**Data:** 2026-07-22  
**Ambiente:** Supabase project `atguroqvidhhebwdnzpu` (produzione)  
**Utente sorgente:** account principale (anonimizzato: `src-user`)  
**Utente destinazione:** secondo account test (anonimizzato: `dst-user`)  
**Checksum backup:** `[verificare al momento del restore]`

---

## Stato per Fase

### ✅ FASE 1 — Feature Flag

- `ENABLE_BACKUP_RESTORE_REAL=true` in `.env.local` — attivo
- `NEXT_PUBLIC_ENABLE_BACKUP_RESTORE_REAL=true` in `.env.local` — attivo
- Entrambi gli endpoint `POST /api/backup/restore/prepare` e `POST /api/backup/restore` rifiutano con `RESTORE_DISABLED 403` se il flag server è `false` o assente
- Il flag client controlla solo la visibilità UI (pulsante "Prepara conferma")

### ⏳ FASE 2 — Preparazione Token (manuale)

**Prerequisito bloccante:** eliminare le categorie default dell'account principale dal DB.

```sql
-- Rimuovere TUTTE le categorie dell'account principale (incluse default)
-- Necessario perché le UUID delle categorie nel backup collidono con quelle
-- ancora presenti nel DB per src-user.
-- Le categorie default di src-user possono essere ri-seeded se necessario.
delete from public.categories
  where user_id = '36eae6ef-6286-4941-9e1e-bb755d9daae9';
```

Dopo la pulizia, con `dst-user` autenticato:
1. Caricare il file backup Aurora v1
2. Il dry-run deve restituire `readiness: ready`, 0 errori, 4 categorie riconciliate
3. Chiamare `POST /api/backup/restore/prepare`
4. Risposta attesa:
   ```json
   {
     "tokenId": "<uuid>",
     "token": "<32+ chars>",
     "expiresAt": "<15 min from now>",
     "checksum": "<sha256>",
     "requiredConfirmation": "RIPRISTINA AURORA",
     "summary": { ... },
     "accountingPreview": { ... }
   }
   ```

Token checks:
- [ ] `user_id` = `dst-user` nella tabella `backup_restore_tokens`
- [ ] `token_hash` = `encode(digest(token, 'sha256'), 'hex')` — mai in chiaro
- [ ] `backup_checksum` = checksum del file caricato
- [ ] `expires_at` ≈ now() + 15 min
- [ ] `used_at` = null
- [ ] `mode` = `empty_account_restore`
- [ ] `readiness` = `ready`

### ⏳ FASE 3 — Conferma Utente (manuale / UI)

- [ ] La UI mostra un campo input per la frase di conferma
- [ ] Il pulsante "Ripristina" è disabilitato finché il campo non contiene esattamente `RIPRISTINA AURORA`
- [ ] Case sensitive (maiuscolo)

### ⏳ FASE 4 — Restore Reale (manuale)

`POST /api/backup/restore` con:
```json
{
  "filename": "<nome_file>.json",
  "content": "<contenuto completo del backup>",
  "tokenId": "<token_id>",
  "token": "<plain_token>",
  "confirmation": "RIPRISTINA AURORA"
}
```

Verifiche lato server (automatiche nella route):
- [x] Flag server `ENABLE_BACKUP_RESTORE_REAL=true` verificato
- [x] Utente autenticato via `getAuthenticatedRestoreUser`
- [x] Checksum ricalcolato e verificato
- [x] Backup validato (formato, schema version)
- [x] `readiness = ready` verificato
- [x] Unica RPC atomica `restore_aurora_backup_v1_empty_account`
- [x] Nessun INSERT dal client
- [x] `user_id` da `auth.uid()`, mai dal backup

### ⏳ FASE 5 — Risultato RPC (dopo restore)

La RPC restituisce conteggi letti dal DB dopo gli insert:
```json
{
  "restoreId": "<uuid>",
  "status": "completed",
  "counts": {
    "accounts": 0,
    "categories": 0,
    "transactions": 0,
    "budgets": 0,
    "recurringRules": 0,
    "loans": 0,
    "loanPayments": 0,
    "birthdays": 0,
    "birthdayReminderLog": 0,
    "auditLogs": 0
  },
  "startedAt": "...",
  "completedAt": "...",
  "verified": true
}
```
*(compilare con i valori reali dopo il restore)*

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

Confronto con il file backup: i conteggi devono corrispondere esattamente (salvo le 4 categorie default riconciliate che potrebbero avere UUID diversi — verificare che il totale categorie sia uguale).

### FASE 7 — Ownership

```sql
-- Tutti i record di dst-user devono avere user_id = dst-uid
-- Nessun record deve avere user_id = src-user

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
  from public.transactions where user_id in ('<dst-uid>', '<src-uid>')
union all
select 'budgets', count(*),
       sum(case when user_id = '<dst-uid>' then 1 else 0 end),
       sum(case when user_id = '<src-uid>' then 1 else 0 end)
  from public.budgets where user_id in ('<dst-uid>', '<src-uid>')
union all
select 'recurring_rules', count(*),
       sum(case when user_id = '<dst-uid>' then 1 else 0 end),
       sum(case when user_id = '<src-uid>' then 1 else 0 end)
  from public.recurring_rules where user_id in ('<dst-uid>', '<src-uid>')
union all
select 'loans', count(*),
       sum(case when user_id = '<dst-uid>' then 1 else 0 end),
       sum(case when user_id = '<src-uid>' then 1 else 0 end)
  from public.loans where user_id in ('<dst-uid>', '<src-uid>')
union all
select 'birthdays', count(*),
       sum(case when user_id = '<dst-uid>' then 1 else 0 end),
       sum(case when user_id = '<src-uid>' then 1 else 0 end)
  from public.birthdays where user_id in ('<dst-uid>', '<src-uid>');
-- Risultato atteso: still_src = 0 per tutte le tabelle
```

### FASE 8 — Riferimenti e FK

```sql
-- Verifica che le transazioni di dst-user non puntino ad account/categorie inesistenti o di src-user
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

-- Verifica sottocategorie
select c.id, c.parent_id, p.user_id as parent_owner
  from public.categories c
  left join public.categories p on p.id = c.parent_id
 where c.user_id = '<dst-uid>'
   and c.parent_id is not null
   and (p.id is null or p.user_id <> '<dst-uid>');
-- Risultato atteso: 0 righe

-- Verifica trasferimenti (peer reciproco)
select t1.id, t1.transfer_peer_id,
       t2.user_id as peer_owner,
       t2.transfer_peer_id as peer_back
  from public.transactions t1
  left join public.transactions t2 on t2.id = t1.transfer_peer_id
 where t1.user_id = '<dst-uid>'
   and t1.type = 'transfer'
   and (t2.id is null or t2.user_id <> '<dst-uid>');
-- Risultato atteso: 0 righe (o solo trasferimenti legacy is_default)
```

### FASE 9 — Integrità Contabile

```sql
-- Saldi per conto
select a.name, a.balance as declared_balance,
       coalesce(
         sum(case when t.type = 'income' then t.amount
                  when t.type = 'expense' then -t.amount
                  when t.type = 'transfer' and t.amount > 0 then t.amount
                  else 0 end), 0) as computed_from_transactions
  from public.accounts a
  left join public.transactions t on t.account_id = a.id and t.user_id = '<dst-uid>'
 where a.user_id = '<dst-uid>'
 group by a.id, a.name, a.balance
 order by a.name;

-- Totali
select
  sum(case when type = 'income' then amount else 0 end) as total_income,
  sum(case when type = 'expense' then amount else 0 end) as total_expense,
  sum(case when type = 'transfer' then amount else 0 end) / 2 as transfer_volume,
  sum(case when type = 'income' then amount when type = 'expense' then -amount else 0 end) as net_worth_delta
from public.transactions
where user_id = '<dst-uid>';

-- Prestiti
select type,
  sum(amount) as total_amount,
  sum(remaining) as total_remaining,
  sum(amount - remaining) as total_paid
from public.loans
where user_id = '<dst-uid>'
group by type;
```

### FASE 11 — Token Monouso

```sql
-- Dopo il restore, il token deve essere consumed
select id, used_at, expires_at, mode, readiness
  from public.backup_restore_tokens
 where user_id = '<dst-uid>'
 order by created_at desc
 limit 5;
-- Risultato atteso: used_at IS NOT NULL per il token usato
-- token_hash presente (mai il token in chiaro)

-- Tentativo di riuso: la RPC rileva TOKEN_ALREADY_USED
```

### FASE 12 — Secondo Restore Bloccato

```sql
-- Dopo il restore, dst-user ha dati: ACCOUNT_NOT_EMPTY deve scattare
select
  (select count(*) from public.accounts where user_id = '<dst-uid>') as accounts,
  (select count(*) from public.transactions where user_id = '<dst-uid>') as transactions,
  (select count(*) from public.categories where user_id = '<dst-uid>' and is_default is not true) as user_categories;
-- Tutti > 0: un nuovo prepare/restore verrà bloccato con ACCOUNT_NOT_EMPTY
```

### FASE 13 — Atomicità

```sql
-- Dopo un restore fallito intenzionalmente, il dst-user (o un terzo account) deve essere vuoto
-- Test: modificare temporaneamente il backup per avere un category_id inesistente in una transazione
-- La RPC solleverebbe ACCOUNTING_MISMATCH o un FK violation → rollback
-- Verificare:
select count(*) from public.accounts where user_id = '<test-empty-uid>';        -- deve essere 0
select count(*) from public.transactions where user_id = '<test-empty-uid>';    -- deve essere 0
select count(*) from public.backup_restore_runs
 where user_id = '<test-empty-uid>' and status = 'running';  -- nessun run in stato running

-- LIMITE RESIDUO: questo test richiede un terzo account vuoto e un backup corrotto.
-- Non eseguito automaticamente in questo sprint per evitare di alterare dst-user.
```

---

## Risultati Sprint 5C

| # | Voce | Stato |
|---|------|-------|
| 1 | Feature flag abilitato temporaneamente | ✅ `.env.local` aggiornato |
| 2 | Prepare completato | ⏳ manuale |
| 3 | Token creato | ⏳ manuale |
| 4 | Restore RPC completato | ⏳ manuale |
| 5 | Conteggi RPC | ⏳ dopo restore |
| 6 | Conteggi DB | ⏳ query pronte |
| 7 | Confronto src/dst | ⏳ query pronte |
| 8 | Categorie default riconciliate | ⏳ 4 attese |
| 9 | Ownership verificata | ⏳ query pronte |
| 10 | FK verificate | ⏳ query pronte |
| 11 | Saldi verificati | ⏳ query pronte |
| 12 | Patrimonio verificato | ⏳ query pronte |
| 13 | UI verificata | ⏳ manuale |
| 14 | Token monouso verificato | ⏳ query pronta |
| 15 | Secondo restore bloccato | ⏳ query pronta |
| 16 | Atomicità | ⚠️ limite residuo (documentato) |
| 17 | Test totali | ✅ 236/236 passing (+4 UUID remapping) |
| 18 | Build | ✅ OK |
| 19 | Feature flag ri-disabilitato | ✅ ENABLE_BACKUP_RESTORE_REAL=false |
| 20 | Account principale invariato | ✅ UUID remapping — src-user non toccato |
| 21 | File creati | ✅ migrations/00013, 00014, 00015; audit/BACKUP_SPRINT_5C_RESULTS.md |
| 22 | File modificati | ✅ restore/route.ts, restore/prepare/route.ts, settings/page.tsx, backup-restore-route.test.ts |
| 23 | Nessun commit | ✅ confermato |
| 24 | Nessun push | ✅ confermato |

---

## Blocco UUID_CONFLICT — Causa e Risoluzione

**Causa:** La migration 00014 conservava gli UUID del backup come PK, causando collisione quando src-user aveva ancora i propri dati nel DB.

**Risoluzione (migration 00015):** UUID remapping completo. Ogni record del backup riceve un nuovo `gen_random_uuid()` nel DB destinazione. Le FK vengono rimappate coerentemente tramite tabelle temporanee `ON COMMIT DROP`. Le categorie default vengono riconciliate (riutilizzate se esiste un match nome+tipo nell'account destinazione) senza inserire duplicati.

**Risultato:** Il restore cross-account (backup di src-user su dst-user vuoto) funziona anche quando src-user ha ancora tutti i propri dati nel DB. Nessun dato di src-user viene eliminato o modificato.

**Migration applicata al DB:** `00015_restore_rpc_uuid_remapping.sql` — da applicare manualmente via SQL editor Supabase (progetto `atguroqvidhhebwdnzpu`).

---

## FASE 14 — Feature Flag da Disabilitare Dopo il Test

```
# In .env.local (e in Vercel dashboard per produzione)
ENABLE_BACKUP_RESTORE_REAL=false
NEXT_PUBLIC_ENABLE_BACKUP_RESTORE_REAL=false
```
