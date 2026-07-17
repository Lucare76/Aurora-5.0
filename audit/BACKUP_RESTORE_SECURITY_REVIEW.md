# Backup Restore Security Review

## Ambito

Sprint Backup 5 abilita restore reale solo in modalita:

`empty_account_restore`

Non sono disponibili:

- merge;
- replace all;
- force;
- ignore warnings;
- restore parziale;
- restore su account non vuoto.

## Autenticazione

Gli endpoint usano `supabase.auth.getUser()`.

La RPC usa `auth.uid()` e rifiuta utente anonimo.

## Ownership

Il restore ignora qualsiasi `user_id` o owner presente nel backup. Tutti i
record vengono inseriti con `user_id = auth.uid()`.

## Token

Il token e':

- generato server-side;
- casuale;
- hashato nel database;
- valido 5 minuti;
- legato a utente, checksum, schemaVersion e modalita;
- monouso;
- consumato dentro la RPC atomica.

## Endpoint

- `POST /api/backup/restore/prepare`
- `POST /api/backup/restore`

Entrambi restituiscono `Cache-Control: no-store` e
`X-Content-Type-Options: nosniff`.

## Conferma forte

La UI richiede frase esatta:

`RIPRISTINA AURORA`

## RPC

La RPC e' `SECURITY DEFINER` con `search_path = public, pg_temp`.

Motivazione:

- alcune tabelle tecniche non sono scrivibili da utenti normali;
- serve una transazione unica;
- non si vuole una sequenza non atomica di scritture via client/API.

Guardrail:

- niente SQL dinamico;
- niente nome tabella dal client;
- niente user_id target;
- niente flag force/merge/replace;
- grant execute solo ad authenticated.

## Logging

Gli endpoint non loggano payload finanziario. In caso di errore registrano solo
nome/codice errore tecnico.

## Limiti residui

Test DB reali e prova rollback su Supabase locale non eseguiti in questo
ambiente per CLI non linkata. La produzione non e' stata modificata.
