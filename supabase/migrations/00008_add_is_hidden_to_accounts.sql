-- Migration 00008: campo is_hidden su accounts
-- Permette di nascondere un conto dalla lista senza disattivarlo.
-- Il flag e' per-utente (gia' garantito dalla FK user_id su accounts).

alter table public.accounts
  add column if not exists is_hidden boolean not null default false;
