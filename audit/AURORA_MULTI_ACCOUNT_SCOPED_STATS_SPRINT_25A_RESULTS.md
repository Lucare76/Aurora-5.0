# Sprint 25A-bis/ter - Contabilita multi-conto e statistiche separate

## Modello a tre perimetri

Aurora usa un tipo centrale `FinanceScope`:

- `PERSONAL` - Personale
- `DEPENDENT_AURORA` - Aurora
- `ADI` - ADI

Il valore legacy `DEPENDENT` resta accettato localmente come alias di `DEPENDENT_AURORA`, per compatibilita con lo Sprint 25 non ancora applicato in remoto.

## Schema database

La migration locale `supabase/migrations/00030_dependent_finance_and_adi.sql` e stata corretta prima dell'applicazione remota.

Oggetti principali:

- `dependent_beneficiaries`: beneficiari, incluso Aurora.
- `account_purpose_links`: ponte tra `accounts` esistenti e perimetro contabile.
- `finance_transfer_metadata`: metadati opzionali dei giroconti tra perimetri.
- `adi_entries`: ledger ADI separato.

Non sono state create tabelle parallele per conti o movimenti Aurora. I conti Aurora restano record della tabella `accounts`; i movimenti restano record della tabella `transactions`.

## Conto iniziale

Il conto "Aurora piano di accumulo" viene suggerito per nome, ma il collegamento stabile avviene tramite `account_id`.

Il conto non viene copiato, non viene duplicato e non viene sommato due volte.

## Piu conti Aurora

La pagina `/aurora` supporta piu conti dedicati. Un nuovo conto Aurora viene creato nella tabella `accounts` e poi collegato server-side con:

- `purpose = DEPENDENT_AURORA`
- beneficiario Aurora

Il client non puo impostare lo scope a `PERSONAL` durante la creazione Aurora.

## Movimenti e giroconti

Le entrate e uscite Aurora usano la RPC atomica esistente `create_transaction_atomic`.

I giroconti supportati sono:

- Personale -> Aurora
- Aurora -> Personale
- Aurora -> Aurora
- Personale -> Personale resta invariato fuori dalla pagina Aurora

Il modello reale del progetto usa giroconti a una riga: `account_id` e il conto origine, `transfer_peer_id` e il conto destinazione. I metadati cross-scope sono descrittivi e non sostituiscono la transazione.

## Semantica statistica

Statistiche personali:

- includono solo `PERSONAL`;
- escludono `DEPENDENT_AURORA`;
- escludono `ADI`.

Statistiche Aurora:

- includono solo conti e movimenti del perimetro Aurora;
- includono anche giroconti in ingresso da personale quando `transfer_peer_id` punta a un conto Aurora;
- escludono giroconti Aurora -> Aurora da entrate e uscite;
- separano trasferimenti personali ricevuti e trasferimenti verso personale.

Statistiche ADI:

- usano solo `adi_entries`;
- accettano solo Supermercato, Benzina, Abbigliamento Aurora;
- mostrano ricevuto, speso, residuo, utilizzo, categorie e andamento mensile.

## Separazione dal patrimonio totale

Aurora e ADI non vengono aggregati nel patrimonio personale totale.

Regole operative:

- il patrimonio personale include solo `PERSONAL`;
- Aurora usa i conti fonte reali marcati `DEPENDENT_AURORA`, ma resta un perimetro separato;
- ADI usa solo il ledger `adi_entries`, ma resta un perimetro separato;
- non viene mostrato un totale aggregato personale + Aurora + ADI nella pagina Aurora.

## Sicurezza e RLS

Le API Aurora e ADI:

- richiedono utente autenticato;
- ignorano `user_id` client;
- validano payload con Zod strict;
- verificano ownership dei conti;
- impongono scope server-side;
- non usano service role nel browser;
- non espongono errori Supabase grezzi in produzione.

La migration abilita RLS sulle nuove tabelle e usa policy basate su `(select auth.uid()) = user_id`.

## Backup export

L'export include:

- beneficiari;
- scope dei conti;
- metadati giroconti tra perimetri;
- record ADI.

Accounts e transactions non sono duplicate in nuove collection.

Export aggiornato; restore completo da finalizzare dopo la stabilizzazione dello schema.

## Test

Sono stati aggiunti/aggiornati test unitari per:

- normalizzazione `FinanceScope`;
- filtri `PERSONAL`, `DEPENDENT_AURORA`, `ADI`;
- alias legacy `DEPENDENT`;
- statistiche Aurora multi-conto;
- classificazione giroconti cross-scope;
- statistiche ADI;
- vincoli statici della migration.

## Limiti residui

- Il restore definitivo dei nuovi oggetti resta rinviato allo Sprint 25B.
- I metadati giroconto cross-scope sono opzionali: la fonte contabile resta `transactions`.
- La migration non e stata applicata in remoto in questo sprint.
