-- Migration 00040: Loan accounting hardening
--
-- Obiettivi:
-- 1. rendere coerente il residuo del prestito con i pagamenti registrati;
-- 2. impedire pagamenti <= 0 e sovrapagamenti;
-- 3. impedire pagamenti associati a prestiti di un altro utente;
-- 4. mantenere la coerenza anche in caso di UPDATE/DELETE di loan_payments;
-- 5. mantenere coerente il residuo quando cambia il capitale originario;
-- 6. non modificare retroattivamente i dati esistenti durante la migration.

-- ============================================================
-- 1. Vincoli di dominio sui prestiti
-- ============================================================
-- NOT VALID evita che eventuali dati storici incoerenti blocchino il deploy.
-- I nuovi INSERT/UPDATE sono comunque soggetti al vincolo; la validazione completa
-- potra' essere eseguita dopo un audit dei dati storici.
alter table public.loans
  drop constraint if exists loans_amount_positive;
alter table public.loans
  add constraint loans_amount_positive check (amount > 0) not valid;

alter table public.loans
  drop constraint if exists loans_remaining_valid;
alter table public.loans
  add constraint loans_remaining_valid check (remaining >= 0 and remaining <= amount) not valid;

alter table public.loan_payments
  drop constraint if exists loan_payments_amount_positive;
alter table public.loan_payments
  add constraint loan_payments_amount_positive check (amount > 0) not valid;

-- ============================================================
-- 2. Modifica capitale: residuo ricalcolato dai pagamenti
-- ============================================================
create or replace function public.sync_loan_on_amount_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paid numeric(15,2);
begin
  if new.amount <= 0 then
    raise exception 'Loan amount must be positive';
  end if;

  select coalesce(sum(lp.amount), 0)
    into v_paid
    from public.loan_payments lp
   where lp.loan_id = old.id;

  if v_paid > new.amount then
    raise exception 'Loan amount cannot be lower than payments already registered';
  end if;

  new.remaining := new.amount - v_paid;
  new.is_settled := (new.remaining = 0);
  new.settled_at := case
    when new.remaining = 0 then coalesce(old.settled_at, now())
    else null
  end;
  new.updated_at := now();

  return new;
end;
$$;

revoke execute on function public.sync_loan_on_amount_change() from public, anon, authenticated;

drop trigger if exists sync_loan_on_amount_change on public.loans;
create trigger sync_loan_on_amount_change
before update of amount
on public.loans
for each row
when (old.amount is distinct from new.amount)
execute function public.sync_loan_on_amount_change();

-- ============================================================
-- 3. Validazione pagamento prima della scrittura
-- ============================================================
create or replace function public.validate_loan_payment_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_loan public.loans%rowtype;
  v_other_payments numeric(15,2);
begin
  select *
    into v_loan
    from public.loans
   where id = new.loan_id
   for update;

  if v_loan.id is null then
    raise exception 'Loan not found';
  end if;

  if v_uid is not null and v_loan.user_id <> v_uid then
    raise exception 'Loan not owned by current user';
  end if;

  if new.user_id <> v_loan.user_id then
    raise exception 'Loan payment owner must match loan owner';
  end if;

  if new.amount <= 0 then
    raise exception 'Loan payment amount must be positive';
  end if;

  select coalesce(sum(lp.amount), 0)
    into v_other_payments
    from public.loan_payments lp
   where lp.loan_id = new.loan_id
     and (tg_op <> 'UPDATE' or lp.id <> old.id);

  if v_other_payments + new.amount > v_loan.amount then
    raise exception 'Loan payment exceeds outstanding principal';
  end if;

  return new;
end;
$$;

revoke execute on function public.validate_loan_payment_mutation() from public, anon, authenticated;

drop trigger if exists validate_loan_payment_mutation on public.loan_payments;
create trigger validate_loan_payment_mutation
before insert or update of loan_id, user_id, amount
on public.loan_payments
for each row execute function public.validate_loan_payment_mutation();

-- ============================================================
-- 4. Residuo derivato atomicamente dai pagamenti
-- ============================================================
create or replace function public.sync_loan_from_payments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loan_id uuid;
  v_total_paid numeric(15,2);
  v_amount numeric(15,2);
  v_remaining numeric(15,2);
begin
  v_loan_id := case when tg_op = 'DELETE' then old.loan_id else new.loan_id end;

  -- Se in UPDATE il pagamento viene spostato a un altro prestito, riallinea prima
  -- il vecchio prestito e poi quello nuovo.
  if tg_op = 'UPDATE' and old.loan_id <> new.loan_id then
    select l.amount, coalesce(sum(lp.amount), 0)
      into v_amount, v_total_paid
      from public.loans l
      left join public.loan_payments lp on lp.loan_id = l.id
     where l.id = old.loan_id
     group by l.id, l.amount;

    if v_amount is not null then
      v_remaining := greatest(v_amount - v_total_paid, 0);
      update public.loans
         set remaining = v_remaining,
             is_settled = (v_remaining = 0),
             settled_at = case
               when v_remaining = 0 then coalesce(settled_at, now())
               else null
             end,
             updated_at = now()
       where id = old.loan_id;
    end if;
  end if;

  select l.amount, coalesce(sum(lp.amount), 0)
    into v_amount, v_total_paid
    from public.loans l
    left join public.loan_payments lp on lp.loan_id = l.id
   where l.id = v_loan_id
   group by l.id, l.amount;

  -- DELETE CASCADE del prestito: il parent puo' gia' non essere disponibile.
  if v_amount is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_remaining := greatest(v_amount - v_total_paid, 0);

  update public.loans
     set remaining = v_remaining,
         is_settled = (v_remaining = 0),
         settled_at = case
           when v_remaining = 0 then coalesce(settled_at, now())
           else null
         end,
         updated_at = now()
   where id = v_loan_id;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke execute on function public.sync_loan_from_payments() from public, anon, authenticated;

drop trigger if exists sync_loan_from_payments on public.loan_payments;
create trigger sync_loan_from_payments
after insert or update or delete
on public.loan_payments
for each row execute function public.sync_loan_from_payments();

-- ============================================================
-- 5. RPC canonica per registrare un pagamento
-- ============================================================
-- La UI attuale continua a funzionare grazie ai trigger sopra. Questa RPC diventa
-- il contratto canonico per nuovi client: lock del prestito + insert pagamento +
-- aggiornamento residuo avvengono nella stessa transazione Postgres.
create or replace function public.record_loan_payment_atomic(
  p_loan_id uuid,
  p_amount numeric,
  p_paid_at timestamptz default now(),
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_loan public.loans%rowtype;
  v_payment public.loan_payments%rowtype;
  v_updated public.loans%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select *
    into v_loan
    from public.loans
   where id = p_loan_id
   for update;

  if v_loan.id is null then
    raise exception 'Loan not found';
  end if;
  if v_loan.user_id <> v_uid then
    raise exception 'Loan not owned by current user';
  end if;
  if v_loan.is_settled or v_loan.remaining <= 0 then
    raise exception 'Loan is already settled';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Loan payment amount must be positive';
  end if;
  if p_amount > v_loan.remaining then
    raise exception 'Loan payment exceeds outstanding principal';
  end if;

  insert into public.loan_payments (loan_id, user_id, amount, paid_at, notes)
  values (p_loan_id, v_uid, p_amount, coalesce(p_paid_at, now()), p_notes)
  returning * into v_payment;

  -- Il trigger AFTER INSERT ha gia' aggiornato il prestito nella stessa transazione.
  select * into v_updated from public.loans where id = p_loan_id;

  return jsonb_build_object(
    'payment', to_jsonb(v_payment),
    'loan', to_jsonb(v_updated)
  );
end;
$$;

revoke all on function public.record_loan_payment_atomic(uuid, numeric, timestamptz, text) from public;
grant execute on function public.record_loan_payment_atomic(uuid, numeric, timestamptz, text) to authenticated;
