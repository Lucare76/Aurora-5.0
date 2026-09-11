-- Backfill: preserva il patrimonio personale visibile oggi per il conto ponte/specchio
-- "Aurora piano di accumulo" prima di rimuovere il bypass legacy basato sul nome che lo
-- includeva sempre nel perimetro PERSONAL (vedi getPersonalExcludedAccountIds in
-- src/lib/dependent-finance/calculations.ts).
--
-- Fino ad oggi quel conto compariva nel patrimonio personale anche senza una riga
-- purpose='PERSONAL' esplicita in account_purpose_links, per un match sul nome
-- (case/whitespace-insensitive, stessa regola di isSharedAuroraAccumulationAccount:
-- lower(trim(name)) = 'aurora piano di accumulo'). Una volta rimosso quel bypass dal
-- codice, il checkbox "Includi anche nel patrimonio personale" diventa l'unica fonte di
-- verita': questa migration inserisce quindi, una tantum, la riga PERSONAL mancante per
-- i soli conti che oggi dipendono dal bypass, cosi' il patrimonio calcolato non cambia
-- per nessun utente esistente nel momento in cui il fix va in produzione. Da qui in poi
-- il checkbox controlla la riga PERSONAL come per qualsiasi altro conto.
--
-- Purpose legacy: la colonna purpose accetta sia 'DEPENDENT' (valore storico, ancora
-- scritto oggi da linkAuroraAccount/AURORA_SCOPE in src/app/api/aurora/route.ts) sia
-- 'DEPENDENT_AURORA' (valore introdotto con il multi-scope). In produzione i conti
-- Aurora collegati prima del multi-scope hanno purpose='DEPENDENT', non 'DEPENDENT_AURORA':
-- il codice TypeScript li tratta in modo identico tramite normalizeFinanceScope()
-- ('DEPENDENT' -> 'DEPENDENT_AURORA'), quindi anche qui il backfill deve considerare
-- entrambi i valori per restare allineato allo stato reale del database. Non viene
-- scritto ne' modificato alcun valore 'DEPENDENT' esistente: si aggiunge solo, se manca,
-- la riga PERSONAL accanto ad esso.
--
-- Non distruttiva: solo INSERT, nessun DELETE/UPDATE su account_purpose_links, accounts
-- o transactions. Idempotente: NOT EXISTS impedisce di inserire una riga PERSONAL
-- duplicata se la migration viene rieseguita, DISTINCT evita un doppio INSERT nello
-- stesso statement per un conto che avesse (caso limite) sia una riga 'DEPENDENT' sia
-- una 'DEPENDENT_AURORA', e il vincolo unique (user_id, account_id, purpose) introdotto
-- in 00037 la rende comunque sicura in caso di race.

insert into public.account_purpose_links (user_id, account_id, beneficiary_id, purpose, label)
select distinct
  apl.user_id,
  apl.account_id,
  null,
  'PERSONAL',
  null
from public.account_purpose_links apl
join public.accounts a
  on a.id = apl.account_id
  and a.user_id = apl.user_id
where apl.purpose in ('DEPENDENT', 'DEPENDENT_AURORA')
  and lower(trim(a.name)) = lower(trim('Aurora piano di accumulo'))
  and not exists (
    select 1
    from public.account_purpose_links personal
    where personal.user_id = apl.user_id
      and personal.account_id = apl.account_id
      and personal.purpose = 'PERSONAL'
  );
