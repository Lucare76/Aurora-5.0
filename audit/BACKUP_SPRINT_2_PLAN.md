# Backup Sprint 2 - Piano

## Riferimenti verificati

- `audit/BACKUP_FORMAT_SPECIFICATION.md`
- `audit/BACKUP_DATA_INVENTORY.md`
- `audit/BACKUP_GAP_ANALYSIS.md`
- `audit/BACKUP_VALIDATION_PLAN.md`
- `audit/BACKUP_ID_RELATIONSHIP_STRATEGY.md`
- `audit/BACKUP_ACCOUNTING_INTEGRITY_PLAN.md`
- `audit/examples/aurora-backup-v1.example.json`
- `src/types/database.ts`

## Adattamenti al modello reale

- Il formato v1 include solo entita' realmente presenti nel progetto: profile, accounts, categories, transactions, budgets, recurringRules, loans, loanPayments, birthdays, birthdayReminderLog, auditLogs.
- `user_id` puo' apparire nei record storici, ma e' trattato come non attendibile e produce issue informativa.
- `transfer_peer_id` resta supportato per entrambi i modelli attuali: destination account e legacy peer transaction.
- Non vengono inventate entita' come import history o ledger deduplica perche' non esistono nello schema reale.
- Receipt file reali non sono inclusi; sono supportati solo `receipt_url` e `receipt_data` presenti nelle transazioni.

## Implementazione prevista

- Modulo puro in `src/lib/backup/`.
- Validazione con Zod gia' presente nel progetto.
- Checksum SHA-256 deterministico con canonicalizzazione.
- Test unitari Node, nessun Supabase, nessuna rete, nessuna scrittura.

## Vincoli

- Nessuna modifica UI.
- Nessuna modifica API/RPC.
- Nessuna modifica export/import esistente.
- Nessuna migration.
- Nessun restore.
- Nessun commit/push.
