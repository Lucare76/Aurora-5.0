-- Migration 00009: rimuove la FK su transactions.transfer_peer_id
--
-- Problema: il DB live ha transfer_peer_id FK → transactions(id) (vecchio modello a 2 righe),
-- ma create_transaction_atomic salva l'UUID del conto destinatario (modello a 1 riga).
-- Questo causava il fallimento di tutti i giroconti con errore FK violation.
--
-- Soluzione: si elimina il constraint FK. transfer_peer_id rimane un UUID libero:
--   - vecchie righe: contengono l'UUID della transazione gemella (compatibile, nessun errore)
--   - nuove righe:   contengono l'UUID del conto destinatario (usato dall'RPC per i saldi)

alter table public.transactions
  drop constraint if exists transactions_transfer_peer_id_fkey;
