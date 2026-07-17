# Sprint 5 - Risultati dry-run migrazione

## Draft preparato

File:

`supabase/migrations_draft/00011_normalize_transfer_model_dry_run.sql`

Il draft:

- aggiunge `destination_account_id`;
- aggiunge `peer_transaction_id`;
- aggiunge `transfer_model`;
- classifica giroconti one-row come `destination_account`;
- classifica giroconti legacy two-row come `peer_transaction`;
- segnala riferimenti non risolti come `orphan`;
- crea indici parziali locali;
- include query di verifica;
- termina con `rollback;`.

## Stato applicazione

Il draft non e' stato applicato a produzione e non e' in `supabase/migrations/`.

In questa sessione `npx supabase@latest status` e `npx supabase@latest --version` sono andati in timeout, quindi non e' stato possibile confermare un Supabase locale avviato. Per sicurezza il dry-run non e' stato eseguito.

## Verifica

Query di verifica preparate in:

`audit/SPRINT_5_MIGRATION_VERIFICATION.sql`

Risultato atteso sul DB locale dopo fixture:

- nessun link `destination_account_id` rotto;
- nessun link `peer_transaction_id` rotto;
- giroconti legacy classificati come `peer_transaction`;
- giroconti nuovi classificati come `destination_account`;
- nessun cambiamento al patrimonio netto.

## Note operative

L'esecuzione dry-run dipende dalla disponibilita' di Supabase locale o clone dedicato e dalle variabili `SUPABASE_TEST_*`. In assenza di ambiente isolato configurato, il dry-run resta preparato ma non viene eseguito.
