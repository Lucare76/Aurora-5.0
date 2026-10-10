-- Track installment purchases without posting future expenses to account balances.
create table public.installment_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  total_installments integer not null check (total_installments between 2 and 360),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.installment_payments (
  transaction_id uuid primary key references public.transactions(id) on delete cascade,
  plan_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  installment_number integer not null check (installment_number between 1 and 360),
  created_at timestamptz not null default now(),
  foreign key (plan_id, user_id) references public.installment_plans(id, user_id) on delete cascade,
  unique (plan_id, installment_number)
);
create index installment_plans_user_idx on public.installment_plans(user_id);
create index installment_payments_user_plan_idx on public.installment_payments(user_id, plan_id);

alter table public.installment_plans enable row level security;
alter table public.installment_payments enable row level security;
create policy "View own installment plans" on public.installment_plans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "View own installment payments" on public.installment_payments
  for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.installment_plans, public.installment_payments to authenticated;
revoke all on public.installment_plans, public.installment_payments from anon;

create or replace function public.link_installment_payment(
  p_transaction_id uuid,
  p_plan_id uuid default null,
  p_title text default null,
  p_total_installments integer default null,
  p_installment_number integer default null
) returns public.installment_payments
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tx public.transactions%rowtype;
  v_plan public.installment_plans%rowtype;
  v_payment public.installment_payments%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_tx from public.transactions
    where id = p_transaction_id and user_id = v_uid for update;
  if not found or v_tx.type <> 'expense' or v_tx.transfer_peer_id is not null then
    raise exception 'Expense not found';
  end if;

  if p_plan_id is null then
    if p_title is null or length(btrim(p_title)) not between 1 and 120
       or p_total_installments is null or p_total_installments not between 2 and 360 then
      raise exception 'Invalid installment plan';
    end if;
    insert into public.installment_plans(user_id, title, total_installments)
      values (v_uid, btrim(p_title), p_total_installments) returning * into v_plan;
  else
    select * into v_plan from public.installment_plans
      where id = p_plan_id and user_id = v_uid for update;
    if not found then raise exception 'Installment plan not found'; end if;
  end if;

  if p_installment_number is null or p_installment_number not between 1 and v_plan.total_installments then
    raise exception 'Invalid installment number';
  end if;

  insert into public.installment_payments(transaction_id, plan_id, user_id, installment_number)
    values (p_transaction_id, v_plan.id, v_uid, p_installment_number)
    on conflict (transaction_id) do update
      set plan_id = excluded.plan_id, installment_number = excluded.installment_number
    returning * into v_payment;
  return v_payment;
end;
$$;
revoke all on function public.link_installment_payment(uuid,uuid,text,integer,integer) from public, anon;
grant execute on function public.link_installment_payment(uuid,uuid,text,integer,integer) to authenticated;

create or replace function public.create_installment_expense(
  p_account_id uuid,
  p_amount numeric,
  p_date date,
  p_description text,
  p_category_id uuid default null,
  p_notes text default null,
  p_is_neutral boolean default false,
  p_plan_id uuid default null,
  p_title text default null,
  p_total_installments integer default null,
  p_installment_number integer default null
) returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare
  v_tx jsonb;
begin
  -- The existing RPC validates account ownership and posts the balance atomically.
  v_tx := public.create_transaction_atomic(
    p_account_id, 'expense', p_amount, p_date, p_description,
    p_category_id, p_notes, null, null, p_is_neutral
  );
  perform public.link_installment_payment(
    (v_tx->>'id')::uuid, p_plan_id, p_title, p_total_installments, p_installment_number
  );
  return v_tx;
end;
$$;
revoke all on function public.create_installment_expense(uuid,numeric,date,text,uuid,text,boolean,uuid,text,integer,integer) from public, anon;
grant execute on function public.create_installment_expense(uuid,numeric,date,text,uuid,text,boolean,uuid,text,integer,integer) to authenticated;

create or replace function public.unlink_installment_payment(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  delete from public.installment_payments
    where transaction_id = p_transaction_id and user_id = auth.uid();
end;
$$;
revoke all on function public.unlink_installment_payment(uuid) from public, anon;
grant execute on function public.unlink_installment_payment(uuid) to authenticated;

-- Keep links consistent when a normal transaction edit changes an expense into another type.
create or replace function public.remove_nonexpense_installment_link()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type <> 'expense' or new.transfer_peer_id is not null then
    delete from public.installment_payments where transaction_id = new.id;
  end if;
  return new;
end;
$$;
create trigger remove_nonexpense_installment_link
  after update of type, transfer_peer_id on public.transactions
  for each row execute function public.remove_nonexpense_installment_link();
revoke all on function public.remove_nonexpense_installment_link() from public, anon, authenticated;

create or replace function public.update_installment_transaction(
  p_transaction_id uuid,
  p_account_id uuid,
  p_type text,
  p_amount numeric,
  p_date date,
  p_description text,
  p_category_id uuid default null,
  p_notes text default null,
  p_destination_account_id uuid default null,
  p_clear_category boolean default false,
  p_is_neutral boolean default false,
  p_plan_id uuid default null,
  p_title text default null,
  p_total_installments integer default null,
  p_installment_number integer default null,
  p_unlink boolean default false
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_tx jsonb;
begin
  v_tx := public.update_transaction_atomic(
    p_transaction_id, p_account_id, p_type, p_amount, p_date,
    p_description, p_category_id, p_notes, p_destination_account_id,
    p_clear_category, p_is_neutral
  );
  if p_unlink or p_type <> 'expense' then
    perform public.unlink_installment_payment(p_transaction_id);
  else
    perform public.link_installment_payment(
      p_transaction_id, p_plan_id, p_title, p_total_installments, p_installment_number
    );
  end if;
  return v_tx;
end;
$$;
revoke all on function public.update_installment_transaction(uuid,uuid,text,numeric,date,text,uuid,text,uuid,boolean,boolean,uuid,text,integer,integer,boolean) from public, anon;
grant execute on function public.update_installment_transaction(uuid,uuid,text,numeric,date,text,uuid,text,uuid,boolean,boolean,uuid,text,integer,integer,boolean) to authenticated;
