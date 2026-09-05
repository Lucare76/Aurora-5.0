-- Estende le categorie ADI ammesse senza modificare le migration gia' applicate.
alter table public.adi_entries
  drop constraint if exists adi_entries_category_check;

alter table public.adi_entries
  add constraint adi_entries_category_check
  check (
    adi_category is null
    or adi_category in (
      'SUPERMERCATO',
      'BENZINA',
      'ABBIGLIAMENTO_AURORA',
      'MACELLERIA',
      'FARMACIA'
    )
  );
