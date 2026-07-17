# Backup Restore Atomicity Proof

## Strategia

Il ripristino reale di Aurora Backup v1 e' implementato tramite una singola RPC
PostgreSQL:

`public.restore_aurora_backup_v1_empty_account(p_token_id, p_token, p_backup)`

L'endpoint applicativo non esegue una sequenza di insert/update/delete sulle
tabelle contabili. Dopo la rivalidazione server-side chiama una sola RPC.

## Perche e' atomico

PostgreSQL esegue ogni chiamata funzione dentro una transazione. Se una
istruzione dentro la funzione solleva eccezione, l'intera chiamata viene
annullata.

La funzione:

- consuma il token;
- acquisisce advisory lock per utente;
- ricontrolla account vuoto;
- inserisce i record;
- verifica conteggi finali;
- restituisce successo solo dopo le verifiche.

Qualsiasi `raise exception` interrompe la funzione e provoca rollback delle
scritture fatte dalla stessa chiamata.

## Protezione da doppia esecuzione

- token monouso con `used_at`;
- `select ... for update` sul token;
- `pg_advisory_xact_lock` legato all'utente;
- ricontrollo account vuoto dentro la transazione.

## Punto importante

Il log `backup_restore_runs` e il consumo token sono nella stessa transazione
del restore. In caso di rollback vengono annullati insieme alle scritture dati.
Questa scelta preserva atomicita totale; l'eventuale errore resta visibile a
livello API/log applicativo, non come record persistito DB.

## Prova eseguita in questo ambiente

Sono stati eseguiti:

- test API mock su fallimento RPC;
- verifica che l'endpoint restore chiami una sola RPC;
- build TypeScript/Next;
- test unitari e API.

Non e' stato possibile eseguire test PostgreSQL reali di rollback perche il
progetto Supabase locale/remoto non risulta linkato nel CLI:

`LegacyProjectNotLinkedError: Cannot find project ref. Have you run supabase link?`

La migration non e' stata applicata a produzione.
