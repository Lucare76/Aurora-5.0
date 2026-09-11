-- Multi-scope accounts (un conto puo' appartenere a piu' perimetri: PERSONAL, DEPENDENT_AURORA, ADI)
-- Non destructive, additive-only. Non tocca righe esistenti: ogni conto gia' collegato mantiene
-- esattamente la classificazione odierna finche' non viene aggiunta esplicitamente una riga in piu'
-- per lo stesso account_id (es. una riga PERSONAL accanto a una DEPENDENT_AURORA per un conto
-- dual-purpose come il PAC dedicato ad Aurora).
--
-- Idempotente: questa migration e' stata applicata manualmente in produzione in una versione
-- precedente (stesso effetto, nome file diverso). I controlli "if exists" / "if not exists"
-- rendono sicuro rieseguirla sia su ambienti dove il vincolo vecchio esiste ancora, sia dove
-- e' gia' stato sostituito da quello nuovo.

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'account_purpose_links_user_account_unique'
      and conrelid = 'public.account_purpose_links'::regclass
  ) then
    alter table public.account_purpose_links
      drop constraint account_purpose_links_user_account_unique;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'account_purpose_links_user_account_purpose_unique'
      and conrelid = 'public.account_purpose_links'::regclass
  ) then
    alter table public.account_purpose_links
      add constraint account_purpose_links_user_account_purpose_unique unique (user_id, account_id, purpose);
  end if;
end $$;
