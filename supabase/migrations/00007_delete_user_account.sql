-- Migration 00007: funzione per eliminare tutti i dati di un utente
-- Chiamata dal client con l'utente autenticato (SECURITY DEFINER)
-- NON elimina la riga auth.users (richiede service role) — l'utente viene disconnesso
-- Le FK su auth.users hanno on delete cascade, ma questa funzione
-- elimina i dati in ordine esplicito per massima compatibilità.

create or replace function public.delete_user_account(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Solo l'utente stesso può eliminare il proprio account
  if auth.uid() is null or auth.uid() != p_user_id then
    raise exception 'Non autorizzato';
  end if;

  -- 1. Log di audit (nullable user_id, pulire comunque)
  delete from public.audit_logs where user_id = p_user_id;

  -- 2. Log promemoria compleanni (FK su birthdays)
  delete from public.birthday_reminder_log where user_id = p_user_id;

  -- 3. Rate dei prestiti (FK su loans)
  delete from public.loan_payments where user_id = p_user_id;

  -- 4. Transazioni
  delete from public.transactions where user_id = p_user_id;

  -- 5. Regole ricorrenti
  delete from public.recurring_rules where user_id = p_user_id;

  -- 6. Budget
  delete from public.budgets where user_id = p_user_id;

  -- 7. Compleanni
  delete from public.birthdays where user_id = p_user_id;

  -- 8. Prestiti
  delete from public.loans where user_id = p_user_id;

  -- 9. Sottocategorie prima (FK su parent_id -> on delete set null, ma è più sicuro)
  delete from public.categories where user_id = p_user_id and parent_id is not null;

  -- 10. Categorie padre
  delete from public.categories where user_id = p_user_id;

  -- 11. Conti
  delete from public.accounts where user_id = p_user_id;

  -- 12. Profilo
  delete from public.profiles where id = p_user_id;
end;
$$;
