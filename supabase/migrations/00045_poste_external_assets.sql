-- Poste Italiane patrimonio import.
-- Adds POSTE as an external asset source without touching accounting balances.

alter table public.external_assets
  drop constraint if exists external_assets_source_type_check;

alter table public.external_assets
  add constraint external_assets_source_type_check
  check (source_type in ('MANUAL', 'SCALABLE', 'SCREENSHOT', 'POSTE'));
