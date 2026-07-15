-- Migration 00010: aggiunge le policy RLS mancanti per UPDATE e DELETE su loan_payments

create policy "Users can update own loan payments"
  on public.loan_payments for update
  using (auth.uid() = user_id);

create policy "Users can delete own loan payments"
  on public.loan_payments for delete
  using (auth.uid() = user_id);
