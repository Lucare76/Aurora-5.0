# Sprint 5 - Piano di rollback

## Ambito

Sprint 5 non deve modificare produzione. Il rollback riguarda solo:

- fixture locale;
- test di integrazione;
- draft migration in `supabase/migrations_draft`;
- documentazione audit.

## Rollback locale DB

Se il dry-run locale lascia dati persistiti:

```powershell
npx supabase@latest db reset
```

Oppure:

```sql
delete from public.transactions where description like 'SPRINT5_IT_%';
delete from public.transactions where user_id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
delete from public.categories where user_id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
delete from public.accounts where user_id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
delete from public.profiles where id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
delete from auth.users where id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
```

## Rollback draft migrazione

Il file `supabase/migrations_draft/00011_normalize_transfer_model_dry_run.sql` termina con `rollback;`, quindi non persiste modifiche quando eseguito com'e'.

Se durante un test locale viene sostituito `rollback;` con `commit;`, revertire con:

```sql
alter table public.transactions drop constraint if exists transactions_transfer_model_check;
drop index if exists public.idx_transactions_destination_account;
drop index if exists public.idx_transactions_peer_transaction;
alter table public.transactions
  drop column if exists destination_account_id,
  drop column if exists peer_transaction_id,
  drop column if exists transfer_model;
```

## Rollback codice test/documenti

Rimuovere solo i file Sprint 5:

- `tests/integration/supabase-accounting.integration.test.ts`
- `tests/integration/fixtures/supabase-accounting-fixture.ts`
- `supabase/migrations_draft/00011_normalize_transfer_model_dry_run.sql`
- documenti `audit/SPRINT_5_*`

Ripristinare in `package.json` la rimozione dello script `test:integration`.
