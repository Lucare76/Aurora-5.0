-- Migration 00006: funzione atomica per creare transazioni ricorrenti lato server
-- Usata dalla Vercel Serverless Function (service role) — non da client browser
-- Accetta p_user_id esplicitamente invece di usare auth.uid()

create or replace function public.create_recurring_transaction(
  p_user_id     uuid,
  p_account_id  uuid,
  p_category_id uuid,
  p_type        text,
  p_amount      numeric,
  p_description text,
  p_date        date,
  p_recurring_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_delta numeric;
begin
  insert into public.transactions (
    user_id, account_id, category_id, type, amount, description, date, recurring_id
  ) values (
    p_user_id, p_account_id, p_category_id, p_type, p_amount, p_description, p_date, p_recurring_id
  );

  v_delta := case when p_type = 'income' then p_amount else -p_amount end;

  update public.accounts
  set balance = balance + v_delta,
      updated_at = now()
  where id = p_account_id
    and user_id = p_user_id;
end;
$$;

-- Solo il service role può chiamare questa funzione
revoke all on function public.create_recurring_transaction(uuid, uuid, uuid, text, numeric, text, date, uuid)
  from public, anon, authenticated;
