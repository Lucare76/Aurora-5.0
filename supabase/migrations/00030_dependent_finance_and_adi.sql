-- Sprint 25 - Patrimonio dedicato e gestione ADI
-- Non destructive, idempotent, RLS-first.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.dependent_beneficiaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  relationship text not null default 'dependent',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dependent_beneficiaries_name_not_empty check (length(trim(name)) > 0),
  constraint dependent_beneficiaries_user_name_unique unique (user_id, name)
);

create table if not exists public.account_purpose_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  beneficiary_id uuid references public.dependent_beneficiaries(id) on delete cascade,
  purpose text not null default 'DEPENDENT_AURORA',
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_purpose_links_purpose_check check (purpose in ('PERSONAL', 'DEPENDENT_AURORA', 'ADI', 'DEPENDENT')),
  constraint account_purpose_links_dependent_requires_beneficiary check (purpose not in ('DEPENDENT', 'DEPENDENT_AURORA') or beneficiary_id is not null),
  constraint account_purpose_links_user_account_unique unique (user_id, account_id)
);

create table if not exists public.finance_transfer_metadata (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_transaction_id uuid not null references public.transactions(id) on delete cascade,
  destination_transaction_id uuid not null references public.transactions(id) on delete cascade,
  source_scope text not null,
  destination_scope text not null,
  reason text,
  note text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_transfer_metadata_scope_check check (
    source_scope in ('PERSONAL', 'DEPENDENT_AURORA', 'ADI')
    and destination_scope in ('PERSONAL', 'DEPENDENT_AURORA', 'ADI')
  ),
  constraint finance_transfer_metadata_unique_source unique (user_id, source_transaction_id),
  constraint finance_transfer_metadata_unique_destination unique (user_id, destination_transaction_id),
  constraint finance_transfer_metadata_idempotency_unique unique (user_id, idempotency_key)
);

create table if not exists public.adi_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete cascade,
  entry_type text not null,
  adi_category text,
  amount numeric(15, 2) not null,
  date date not null,
  reference_period text,
  description text not null,
  note text,
  funding_source text not null default 'ADI',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adi_entries_type_check check (entry_type in ('credit', 'debit')),
  constraint adi_entries_category_check check (adi_category is null or adi_category in ('SUPERMERCATO', 'BENZINA', 'ABBIGLIAMENTO_AURORA')),
  constraint adi_entries_debit_requires_category check (entry_type <> 'debit' or adi_category is not null),
  constraint adi_entries_credit_without_category check (entry_type <> 'credit' or adi_category is null),
  constraint adi_entries_amount_positive check (amount > 0),
  constraint adi_entries_description_not_empty check (length(trim(description)) > 0),
  constraint adi_entries_funding_source_check check (funding_source = 'ADI'),
  constraint adi_entries_reference_period_check check (reference_period is null or reference_period ~ '^[0-9]{4}-[0-9]{2}$')
);

alter table public.dependent_beneficiaries add column if not exists notes text;
alter table public.account_purpose_links add column if not exists label text;
alter table public.finance_transfer_metadata add column if not exists reason text;
alter table public.finance_transfer_metadata add column if not exists note text;
alter table public.finance_transfer_metadata add column if not exists idempotency_key text;
alter table public.adi_entries add column if not exists note text;
alter table public.adi_entries add column if not exists reference_period text;
alter table public.adi_entries add column if not exists funding_source text not null default 'ADI';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'dependent_beneficiaries_name_not_empty'
      and conrelid = 'public.dependent_beneficiaries'::regclass
  ) then
    alter table public.dependent_beneficiaries
      add constraint dependent_beneficiaries_name_not_empty check (length(trim(name)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'dependent_beneficiaries_user_name_unique'
      and conrelid = 'public.dependent_beneficiaries'::regclass
  ) then
    alter table public.dependent_beneficiaries
      add constraint dependent_beneficiaries_user_name_unique unique (user_id, name);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'account_purpose_links_purpose_check'
      and conrelid = 'public.account_purpose_links'::regclass
  ) then
    alter table public.account_purpose_links
      add constraint account_purpose_links_purpose_check check (purpose in ('PERSONAL', 'DEPENDENT_AURORA', 'ADI', 'DEPENDENT'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'account_purpose_links_dependent_requires_beneficiary'
      and conrelid = 'public.account_purpose_links'::regclass
  ) then
    alter table public.account_purpose_links
      add constraint account_purpose_links_dependent_requires_beneficiary check (purpose not in ('DEPENDENT', 'DEPENDENT_AURORA') or beneficiary_id is not null);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'account_purpose_links_user_account_unique'
      and conrelid = 'public.account_purpose_links'::regclass
  ) then
    alter table public.account_purpose_links
      add constraint account_purpose_links_user_account_unique unique (user_id, account_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'finance_transfer_metadata_scope_check'
      and conrelid = 'public.finance_transfer_metadata'::regclass
  ) then
    alter table public.finance_transfer_metadata
      add constraint finance_transfer_metadata_scope_check check (
        source_scope in ('PERSONAL', 'DEPENDENT_AURORA', 'ADI')
        and destination_scope in ('PERSONAL', 'DEPENDENT_AURORA', 'ADI')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'finance_transfer_metadata_unique_source'
      and conrelid = 'public.finance_transfer_metadata'::regclass
  ) then
    alter table public.finance_transfer_metadata
      add constraint finance_transfer_metadata_unique_source unique (user_id, source_transaction_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'finance_transfer_metadata_unique_destination'
      and conrelid = 'public.finance_transfer_metadata'::regclass
  ) then
    alter table public.finance_transfer_metadata
      add constraint finance_transfer_metadata_unique_destination unique (user_id, destination_transaction_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'finance_transfer_metadata_idempotency_unique'
      and conrelid = 'public.finance_transfer_metadata'::regclass
  ) then
    alter table public.finance_transfer_metadata
      add constraint finance_transfer_metadata_idempotency_unique unique (user_id, idempotency_key);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'adi_entries_type_check'
      and conrelid = 'public.adi_entries'::regclass
  ) then
    alter table public.adi_entries
      add constraint adi_entries_type_check check (entry_type in ('credit', 'debit'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'adi_entries_category_check'
      and conrelid = 'public.adi_entries'::regclass
  ) then
    alter table public.adi_entries
      add constraint adi_entries_category_check check (adi_category is null or adi_category in ('SUPERMERCATO', 'BENZINA', 'ABBIGLIAMENTO_AURORA'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'adi_entries_debit_requires_category'
      and conrelid = 'public.adi_entries'::regclass
  ) then
    alter table public.adi_entries
      add constraint adi_entries_debit_requires_category check (entry_type <> 'debit' or adi_category is not null);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'adi_entries_credit_without_category'
      and conrelid = 'public.adi_entries'::regclass
  ) then
    alter table public.adi_entries
      add constraint adi_entries_credit_without_category check (entry_type <> 'credit' or adi_category is null);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'adi_entries_amount_positive'
      and conrelid = 'public.adi_entries'::regclass
  ) then
    alter table public.adi_entries
      add constraint adi_entries_amount_positive check (amount > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'adi_entries_description_not_empty'
      and conrelid = 'public.adi_entries'::regclass
  ) then
    alter table public.adi_entries
      add constraint adi_entries_description_not_empty check (length(trim(description)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'adi_entries_funding_source_check'
      and conrelid = 'public.adi_entries'::regclass
  ) then
    alter table public.adi_entries
      add constraint adi_entries_funding_source_check check (funding_source = 'ADI');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'adi_entries_reference_period_check'
      and conrelid = 'public.adi_entries'::regclass
  ) then
    alter table public.adi_entries
      add constraint adi_entries_reference_period_check check (reference_period is null or reference_period ~ '^[0-9]{4}-[0-9]{2}$');
  end if;
end $$;

create index if not exists idx_dependent_beneficiaries_user on public.dependent_beneficiaries(user_id);
create index if not exists idx_account_purpose_links_user on public.account_purpose_links(user_id);
create index if not exists idx_account_purpose_links_account on public.account_purpose_links(account_id);
create index if not exists idx_account_purpose_links_beneficiary on public.account_purpose_links(beneficiary_id);
create index if not exists idx_finance_transfer_metadata_user on public.finance_transfer_metadata(user_id);
create index if not exists idx_finance_transfer_metadata_source on public.finance_transfer_metadata(source_transaction_id);
create index if not exists idx_finance_transfer_metadata_destination on public.finance_transfer_metadata(destination_transaction_id);
create index if not exists idx_adi_entries_user_date on public.adi_entries(user_id, date desc);
create index if not exists idx_adi_entries_transaction on public.adi_entries(transaction_id) where transaction_id is not null;
create index if not exists idx_adi_entries_category on public.adi_entries(user_id, adi_category) where adi_category is not null;

alter table public.dependent_beneficiaries enable row level security;
alter table public.account_purpose_links enable row level security;
alter table public.finance_transfer_metadata enable row level security;
alter table public.adi_entries enable row level security;

drop policy if exists "Users can view own dependent beneficiaries" on public.dependent_beneficiaries;
create policy "Users can view own dependent beneficiaries"
on public.dependent_beneficiaries for select
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own dependent beneficiaries" on public.dependent_beneficiaries;
create policy "Users can insert own dependent beneficiaries"
on public.dependent_beneficiaries for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own dependent beneficiaries" on public.dependent_beneficiaries;
create policy "Users can update own dependent beneficiaries"
on public.dependent_beneficiaries for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own dependent beneficiaries" on public.dependent_beneficiaries;
create policy "Users can delete own dependent beneficiaries"
on public.dependent_beneficiaries for delete
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own account purpose links" on public.account_purpose_links;
create policy "Users can view own account purpose links"
on public.account_purpose_links for select
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own account purpose links" on public.account_purpose_links;
create policy "Users can insert own account purpose links"
on public.account_purpose_links for insert
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.accounts a
    where a.id = account_id and a.user_id = (select auth.uid())
  )
  and (
    beneficiary_id is null
    or exists (
      select 1 from public.dependent_beneficiaries b
      where b.id = beneficiary_id and b.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Users can update own account purpose links" on public.account_purpose_links;
create policy "Users can update own account purpose links"
on public.account_purpose_links for update
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.accounts a
    where a.id = account_id and a.user_id = (select auth.uid())
  )
  and (
    beneficiary_id is null
    or exists (
      select 1 from public.dependent_beneficiaries b
      where b.id = beneficiary_id and b.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Users can delete own account purpose links" on public.account_purpose_links;
create policy "Users can delete own account purpose links"
on public.account_purpose_links for delete
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own finance transfer metadata" on public.finance_transfer_metadata;
create policy "Users can view own finance transfer metadata"
on public.finance_transfer_metadata for select
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own finance transfer metadata" on public.finance_transfer_metadata;
create policy "Users can insert own finance transfer metadata"
on public.finance_transfer_metadata for insert
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.transactions t
    where t.id = source_transaction_id and t.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.transactions t
    where t.id = destination_transaction_id and t.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update own finance transfer metadata" on public.finance_transfer_metadata;
create policy "Users can update own finance transfer metadata"
on public.finance_transfer_metadata for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own finance transfer metadata" on public.finance_transfer_metadata;
create policy "Users can delete own finance transfer metadata"
on public.finance_transfer_metadata for delete
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own ADI entries" on public.adi_entries;
create policy "Users can view own ADI entries"
on public.adi_entries for select
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own ADI entries" on public.adi_entries;
create policy "Users can insert own ADI entries"
on public.adi_entries for insert
with check (
  (select auth.uid()) = user_id
  and (
    transaction_id is null
    or exists (
      select 1 from public.transactions t
      where t.id = transaction_id and t.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Users can update own ADI entries" on public.adi_entries;
create policy "Users can update own ADI entries"
on public.adi_entries for update
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    transaction_id is null
    or exists (
      select 1 from public.transactions t
      where t.id = transaction_id and t.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Users can delete own ADI entries" on public.adi_entries;
create policy "Users can delete own ADI entries"
on public.adi_entries for delete
using ((select auth.uid()) = user_id);

drop trigger if exists set_updated_at on public.dependent_beneficiaries;
create trigger set_updated_at before update on public.dependent_beneficiaries
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.account_purpose_links;
create trigger set_updated_at before update on public.account_purpose_links
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.finance_transfer_metadata;
create trigger set_updated_at before update on public.finance_transfer_metadata
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.adi_entries;
create trigger set_updated_at before update on public.adi_entries
for each row execute function public.set_updated_at();
