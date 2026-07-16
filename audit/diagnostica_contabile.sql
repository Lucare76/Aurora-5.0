-- Q1 duplicati probabili: stesso utente, conto, data, importo, tipo
SELECT
  user_id,
  account_id,
  date,
  type,
  amount,
  COUNT(*) AS occorrenze,
  ARRAY_AGG(id ORDER BY created_at) AS transaction_ids,
  ARRAY_AGG(description ORDER BY created_at) AS descrizioni
FROM public.transactions
GROUP BY user_id, account_id, date, type, amount
HAVING COUNT(*) > 1
ORDER BY date DESC, occorrenze DESC;

-- Q2 duplicati piu precisi includendo descrizione normalizzata
SELECT
  user_id,
  account_id,
  date,
  type,
  amount,
  LOWER(REGEXP_REPLACE(COALESCE(description, ''), '\s+', ' ', 'g')) AS descrizione_norm,
  COUNT(*) AS occorrenze,
  ARRAY_AGG(id ORDER BY created_at) AS transaction_ids
FROM public.transactions
GROUP BY user_id, account_id, date, type, amount, LOWER(REGEXP_REPLACE(COALESCE(description, ''), '\s+', ' ', 'g'))
HAVING COUNT(*) > 1
ORDER BY date DESC, occorrenze DESC;

-- Q3 classificazione transfer_peer_id: nuovo modello conto, vecchio modello transazione, riferimento assente
SELECT
  t.id,
  t.user_id,
  t.date,
  t.type,
  t.amount,
  t.account_id,
  t.transfer_peer_id,
  CASE
    WHEN t.transfer_peer_id IS NULL THEN 'nessun_peer'
    WHEN da.id IS NOT NULL THEN 'peer_conto_destinazione'
    WHEN pt.id IS NOT NULL THEN 'peer_transazione'
    ELSE 'peer_uuid_non_trovato'
  END AS peer_semantica,
  t.description
FROM public.transactions t
LEFT JOIN public.accounts da ON da.id = t.transfer_peer_id
LEFT JOIN public.transactions pt ON pt.id = t.transfer_peer_id
WHERE t.transfer_peer_id IS NOT NULL
ORDER BY t.date DESC, t.created_at DESC;

-- Q4 trasferimenti orfani o semanticamente sospetti
SELECT
  t.id,
  t.user_id,
  t.date,
  t.type,
  t.amount,
  t.account_id,
  t.transfer_peer_id,
  src.name AS conto_origine,
  dest.name AS conto_destinazione_nuovo_modello,
  peer.id AS transazione_peer_vecchio_modello,
  peer.type AS peer_type,
  peer.amount AS peer_amount,
  peer.account_id AS peer_account_id,
  CASE
    WHEN t.type = 'transfer' AND t.transfer_peer_id IS NULL THEN 'transfer_senza_destinazione'
    WHEN t.type = 'transfer' AND dest.id IS NULL AND peer.id IS NULL THEN 'transfer_peer_non_trovato'
    WHEN t.type = 'transfer' AND dest.id = t.account_id THEN 'origine_destinazione_uguali'
    WHEN peer.id IS NOT NULL AND peer.transfer_peer_id IS DISTINCT FROM t.id THEN 'peer_non_ricambia'
    WHEN peer.id IS NOT NULL AND peer.amount IS DISTINCT FROM t.amount THEN 'peer_importo_diverso'
    WHEN peer.id IS NOT NULL AND peer.account_id = t.account_id THEN 'peer_stesso_conto'
    WHEN peer.id IS NOT NULL AND peer.date IS DISTINCT FROM t.date THEN 'peer_data_diversa'
    WHEN t.type <> 'transfer' AND t.transfer_peer_id IS NOT NULL THEN 'income_expense_con_peer'
    ELSE 'ok_da_verificare'
  END AS anomalia
FROM public.transactions t
LEFT JOIN public.accounts src ON src.id = t.account_id
LEFT JOIN public.accounts dest ON dest.id = t.transfer_peer_id
LEFT JOIN public.transactions peer ON peer.id = t.transfer_peer_id
WHERE
  t.type = 'transfer'
  OR t.transfer_peer_id IS NOT NULL
ORDER BY t.date DESC, t.created_at DESC;

-- Q5 movimenti sospetti e integrita referenziale applicativa
SELECT
  t.id,
  t.user_id,
  t.date,
  t.type,
  t.amount,
  t.account_id,
  t.category_id,
  t.transfer_peer_id,
  t.description,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN t.amount = 0 THEN 'importo_zero' END,
    CASE WHEN t.amount < 0 THEN 'importo_negativo' END,
    CASE WHEN t.type NOT IN ('income', 'expense', 'transfer') THEN 'tipo_non_valido' END,
    CASE WHEN a.id IS NULL THEN 'conto_non_trovato' END,
    CASE WHEN a.id IS NOT NULL AND a.user_id IS DISTINCT FROM t.user_id THEN 'conto_altro_utente' END,
    CASE WHEN t.category_id IS NOT NULL AND c.id IS NULL THEN 'categoria_non_trovata' END,
    CASE WHEN c.id IS NOT NULL AND c.user_id IS DISTINCT FROM t.user_id THEN 'categoria_altro_utente' END,
    CASE WHEN COALESCE(TRIM(t.description), '') = '' THEN 'descrizione_vuota' END,
    CASE WHEN t.date > CURRENT_DATE THEN 'data_futura' END,
    CASE WHEN t.date < DATE '2000-01-01' THEN 'data_pre_2000' END,
    CASE WHEN LOWER(COALESCE(t.description, '')) LIKE '%saldo iniziale%' THEN 'possibile_saldo_iniziale' END
  ], NULL) AS anomalie
FROM public.transactions t
LEFT JOIN public.accounts a ON a.id = t.account_id
LEFT JOIN public.categories c ON c.id = t.category_id
WHERE
  t.amount <= 0
  OR t.type NOT IN ('income', 'expense', 'transfer')
  OR a.id IS NULL
  OR a.user_id IS DISTINCT FROM t.user_id
  OR (t.category_id IS NOT NULL AND (c.id IS NULL OR c.user_id IS DISTINCT FROM t.user_id))
  OR COALESCE(TRIM(t.description), '') = ''
  OR t.date > CURRENT_DATE
  OR t.date < DATE '2000-01-01'
  OR LOWER(COALESCE(t.description, '')) LIKE '%saldo iniziale%'
ORDER BY t.date DESC, t.created_at DESC;

-- Q6 transazioni create nello stesso istante
SELECT
  user_id,
  created_at,
  COUNT(*) AS occorrenze,
  ARRAY_AGG(id ORDER BY date, amount) AS transaction_ids,
  ARRAY_AGG(description ORDER BY date, amount) AS descrizioni
FROM public.transactions
GROUP BY user_id, created_at
HAVING COUNT(*) > 1
ORDER BY created_at DESC;

-- Q7 totali mensili criterio Aurora report: esclude ogni record con transfer_peer_id
SELECT
  user_id,
  DATE_TRUNC('month', date)::date AS mese,
  COUNT(*) FILTER (WHERE type = 'income' AND transfer_peer_id IS NULL) AS numero_entrate,
  COALESCE(SUM(amount) FILTER (WHERE type = 'income' AND transfer_peer_id IS NULL), 0) AS totale_entrate,
  COUNT(*) FILTER (WHERE type = 'expense' AND transfer_peer_id IS NULL) AS numero_uscite,
  COALESCE(SUM(amount) FILTER (WHERE type = 'expense' AND transfer_peer_id IS NULL), 0) AS totale_uscite,
  COUNT(*) FILTER (WHERE type = 'transfer') AS numero_trasferimenti,
  COALESCE(SUM(amount) FILTER (WHERE type = 'transfer'), 0) AS totale_trasferimenti,
  COALESCE(SUM(CASE WHEN type = 'income' AND transfer_peer_id IS NULL THEN amount WHEN type = 'expense' AND transfer_peer_id IS NULL THEN -amount ELSE 0 END), 0) AS netto,
  COUNT(*) FILTER (WHERE category_id IS NULL AND type <> 'transfer') AS senza_categoria,
  COUNT(*) FILTER (WHERE transfer_peer_id IS NOT NULL) AS con_transfer_peer_id,
  COUNT(*) FILTER (WHERE type = 'transfer' AND transfer_peer_id IS NULL) AS transfer_senza_peer
FROM public.transactions
GROUP BY user_id, DATE_TRUNC('month', date)::date
ORDER BY user_id, mese;

-- Q8 totali mensili contando tutte le entrate e uscite
SELECT
  user_id,
  DATE_TRUNC('month', date)::date AS mese,
  COUNT(*) FILTER (WHERE type = 'income') AS numero_entrate,
  COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) AS totale_entrate,
  COUNT(*) FILTER (WHERE type = 'expense') AS numero_uscite,
  COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS totale_uscite,
  COALESCE(SUM(CASE WHEN type = 'income' THEN amount WHEN type = 'expense' THEN -amount ELSE 0 END), 0) AS netto
FROM public.transactions
GROUP BY user_id, DATE_TRUNC('month', date)::date
ORDER BY user_id, mese;

-- Q9 totali mensili escludendo tutte le righe type transfer ma contando income/expense con peer
SELECT
  user_id,
  DATE_TRUNC('month', date)::date AS mese,
  COUNT(*) FILTER (WHERE type = 'income') AS numero_entrate,
  COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) AS totale_entrate,
  COUNT(*) FILTER (WHERE type = 'expense') AS numero_uscite,
  COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS totale_uscite,
  COALESCE(SUM(CASE WHEN type = 'income' THEN amount WHEN type = 'expense' THEN -amount ELSE 0 END), 0) AS netto
FROM public.transactions
WHERE type <> 'transfer'
GROUP BY user_id, DATE_TRUNC('month', date)::date
ORDER BY user_id, mese;

-- Q10 confronto criteri mensili in una sola tabella
WITH all_io AS (
  SELECT user_id, DATE_TRUNC('month', date)::date AS mese,
         SUM(CASE WHEN type = 'income' THEN amount WHEN type = 'expense' THEN -amount ELSE 0 END) AS netto_tutto_io
  FROM public.transactions
  GROUP BY user_id, DATE_TRUNC('month', date)::date
),
no_peer AS (
  SELECT user_id, DATE_TRUNC('month', date)::date AS mese,
         SUM(CASE WHEN type = 'income' AND transfer_peer_id IS NULL THEN amount WHEN type = 'expense' AND transfer_peer_id IS NULL THEN -amount ELSE 0 END) AS netto_senza_peer
  FROM public.transactions
  GROUP BY user_id, DATE_TRUNC('month', date)::date
),
no_transfer_type AS (
  SELECT user_id, DATE_TRUNC('month', date)::date AS mese,
         SUM(CASE WHEN type = 'income' THEN amount WHEN type = 'expense' THEN -amount ELSE 0 END) AS netto_senza_type_transfer
  FROM public.transactions
  WHERE type <> 'transfer'
  GROUP BY user_id, DATE_TRUNC('month', date)::date
)
SELECT
  COALESCE(a.user_id, p.user_id, nt.user_id) AS user_id,
  COALESCE(a.mese, p.mese, nt.mese) AS mese,
  COALESCE(a.netto_tutto_io, 0) AS netto_tutto_io,
  COALESCE(p.netto_senza_peer, 0) AS netto_senza_peer,
  COALESCE(nt.netto_senza_type_transfer, 0) AS netto_senza_type_transfer,
  COALESCE(a.netto_tutto_io, 0) - COALESCE(p.netto_senza_peer, 0) AS differenza_tutto_vs_senza_peer,
  COALESCE(nt.netto_senza_type_transfer, 0) - COALESCE(p.netto_senza_peer, 0) AS differenza_senza_transfer_vs_senza_peer
FROM all_io a
FULL OUTER JOIN no_peer p ON p.user_id = a.user_id AND p.mese = a.mese
FULL OUTER JOIN no_transfer_type nt ON nt.user_id = COALESCE(a.user_id, p.user_id) AND nt.mese = COALESCE(a.mese, p.mese)
ORDER BY user_id, mese;

-- Q11 effetto contabile per conto con semantica mista transfer_peer_id
WITH effetti AS (
  SELECT
    t.user_id,
    t.account_id,
    t.date,
    CASE
      WHEN t.type = 'income' THEN t.amount
      WHEN t.type = 'expense' THEN -t.amount
      WHEN t.type = 'transfer' THEN -t.amount
      ELSE 0
    END AS delta
  FROM public.transactions t
  UNION ALL
  SELECT
    t.user_id,
    dest.id AS account_id,
    t.date,
    t.amount AS delta
  FROM public.transactions t
  JOIN public.accounts dest ON dest.id = t.transfer_peer_id
  WHERE t.type = 'transfer'
)
SELECT
  a.user_id,
  a.id AS account_id,
  a.name,
  a.type,
  a.balance AS saldo_memorizzato,
  COALESCE(SUM(e.delta), 0) AS movimenti_netti,
  a.balance - COALESCE(SUM(e.delta), 0) AS saldo_iniziale_implicito
FROM public.accounts a
LEFT JOIN effetti e ON e.account_id = a.id AND e.user_id = a.user_id
GROUP BY a.user_id, a.id, a.name, a.type, a.balance
ORDER BY a.user_id, a.name;

-- Q12 controllo mensile per conto con saldo iniziale implicito e saldo finale teorico
WITH mesi AS (
  SELECT DISTINCT user_id, DATE_TRUNC('month', date)::date AS mese
  FROM public.transactions
),
effetti AS (
  SELECT user_id, account_id, date,
         CASE WHEN type = 'income' THEN amount WHEN type = 'expense' THEN -amount WHEN type = 'transfer' THEN -amount ELSE 0 END AS delta,
         CASE WHEN type = 'income' AND transfer_peer_id IS NULL THEN amount ELSE 0 END AS entrate,
         CASE WHEN type = 'expense' AND transfer_peer_id IS NULL THEN amount ELSE 0 END AS uscite,
         CASE WHEN type = 'transfer' THEN amount ELSE 0 END AS transfer_out,
         0::numeric AS transfer_in
  FROM public.transactions
  UNION ALL
  SELECT t.user_id, dest.id, t.date,
         t.amount AS delta,
         0::numeric AS entrate,
         0::numeric AS uscite,
         0::numeric AS transfer_out,
         t.amount AS transfer_in
  FROM public.transactions t
  JOIN public.accounts dest ON dest.id = t.transfer_peer_id
  WHERE t.type = 'transfer'
),
saldo0 AS (
  SELECT
    a.user_id,
    a.id AS account_id,
    a.balance - COALESCE(SUM(e.delta), 0) AS saldo_iniziale_implicito
  FROM public.accounts a
  LEFT JOIN effetti e ON e.account_id = a.id AND e.user_id = a.user_id
  GROUP BY a.user_id, a.id, a.balance
)
SELECT
  a.user_id,
  a.id AS account_id,
  a.name,
  m.mese,
  s.saldo_iniziale_implicito
    + COALESCE(SUM(e.delta) FILTER (WHERE e.date < m.mese), 0) AS saldo_iniziale_mese,
  COALESCE(SUM(e.entrate) FILTER (WHERE e.date >= m.mese AND e.date < (m.mese + INTERVAL '1 month')), 0) AS entrate,
  COALESCE(SUM(e.uscite) FILTER (WHERE e.date >= m.mese AND e.date < (m.mese + INTERVAL '1 month')), 0) AS uscite,
  COALESCE(SUM(e.transfer_in) FILTER (WHERE e.date >= m.mese AND e.date < (m.mese + INTERVAL '1 month')), 0) AS trasferimenti_in,
  COALESCE(SUM(e.transfer_out) FILTER (WHERE e.date >= m.mese AND e.date < (m.mese + INTERVAL '1 month')), 0) AS trasferimenti_out,
  s.saldo_iniziale_implicito
    + COALESCE(SUM(e.delta) FILTER (WHERE e.date < (m.mese + INTERVAL '1 month')), 0) AS saldo_finale_teorico
FROM public.accounts a
JOIN mesi m ON m.user_id = a.user_id
JOIN saldo0 s ON s.user_id = a.user_id AND s.account_id = a.id
LEFT JOIN effetti e ON e.user_id = a.user_id AND e.account_id = a.id
GROUP BY a.user_id, a.id, a.name, m.mese, s.saldo_iniziale_implicito
ORDER BY a.user_id, a.name, m.mese;

-- Q13 categorie incongruenti rispetto al tipo transazione
SELECT
  t.id,
  t.user_id,
  t.date,
  t.type AS tipo_transazione,
  t.amount,
  t.description,
  c.id AS category_id,
  c.name AS categoria,
  c.type AS tipo_categoria,
  parent.name AS categoria_padre,
  parent.type AS tipo_padre
FROM public.transactions t
JOIN public.categories c ON c.id = t.category_id
LEFT JOIN public.categories parent ON parent.id = c.parent_id
WHERE
  t.type IN ('income', 'expense')
  AND c.type NOT IN (t.type, 'both')
ORDER BY t.date DESC, t.created_at DESC;

-- Q14 possibili pagamenti carta duplicati con spese carta nello stesso mese
WITH pagamenti_carta AS (
  SELECT
    t.user_id,
    t.id,
    t.date,
    DATE_TRUNC('month', t.date)::date AS mese,
    t.amount,
    t.description,
    a.name AS conto
  FROM public.transactions t
  JOIN public.accounts a ON a.id = t.account_id
  WHERE
    t.type IN ('expense', 'transfer')
    AND (
      LOWER(COALESCE(t.description, '')) LIKE '%american express%'
      OR LOWER(COALESCE(t.description, '')) LIKE '%amex%'
      OR LOWER(COALESCE(t.description, '')) LIKE '%carta%'
    )
),
spese_carta AS (
  SELECT
    t.user_id,
    DATE_TRUNC('month', t.date)::date AS mese,
    COUNT(*) AS numero_spese_carta,
    SUM(t.amount) AS totale_spese_carta
  FROM public.transactions t
  JOIN public.accounts a ON a.id = t.account_id
  WHERE t.type = 'expense' AND LOWER(a.name) LIKE '%carta%'
  GROUP BY t.user_id, DATE_TRUNC('month', t.date)::date
)
SELECT
  p.user_id,
  p.mese,
  p.id AS pagamento_id,
  p.date AS pagamento_data,
  p.amount AS pagamento_importo,
  p.description AS pagamento_descrizione,
  p.conto AS pagamento_conto,
  COALESCE(s.numero_spese_carta, 0) AS numero_spese_carta,
  COALESCE(s.totale_spese_carta, 0) AS totale_spese_carta
FROM pagamenti_carta p
LEFT JOIN spese_carta s ON s.user_id = p.user_id AND s.mese = p.mese
ORDER BY p.user_id, p.mese, p.date;

-- Q15 categorie mancanti o parent incoerente tra utenti
SELECT
  c.id,
  c.user_id,
  c.name,
  c.type,
  c.parent_id,
  p.user_id AS parent_user_id,
  p.name AS parent_name,
  p.type AS parent_type,
  CASE
    WHEN c.parent_id IS NOT NULL AND p.id IS NULL THEN 'parent_non_trovato'
    WHEN p.id IS NOT NULL AND p.user_id IS DISTINCT FROM c.user_id THEN 'parent_altro_utente'
    WHEN p.id IS NOT NULL AND p.type IS DISTINCT FROM c.type THEN 'tipo_diverso_da_parent'
    ELSE 'ok'
  END AS anomalia
FROM public.categories c
LEFT JOIN public.categories p ON p.id = c.parent_id
WHERE
  c.parent_id IS NOT NULL
  AND (
    p.id IS NULL
    OR p.user_id IS DISTINCT FROM c.user_id
    OR p.type IS DISTINCT FROM c.type
  )
ORDER BY c.user_id, c.name;

-- Q16 prestiti e pagamenti incongruenti
SELECT
  l.user_id,
  l.id AS loan_id,
  l.counterpart,
  l.type,
  l.amount,
  l.remaining,
  COALESCE(SUM(lp.amount), 0) AS pagamenti_registrati,
  l.amount - COALESCE(SUM(lp.amount), 0) AS remaining_teorico,
  l.is_settled,
  l.settled_at
FROM public.loans l
LEFT JOIN public.loan_payments lp ON lp.loan_id = l.id
GROUP BY l.user_id, l.id, l.counterpart, l.type, l.amount, l.remaining, l.is_settled, l.settled_at
HAVING l.remaining IS DISTINCT FROM (l.amount - COALESCE(SUM(lp.amount), 0))
ORDER BY l.user_id, l.created_at DESC;

-- ============================================================
-- PROFILAZIONE TRANSFER_PEER_ID
-- ============================================================

-- Q17 profilo completo di ogni transfer_peer_id valorizzato
SELECT
  t.id AS transaction_id,
  t.user_id,
  t.date,
  t.type,
  t.amount,
  t.description,
  t.account_id AS source_account_id,
  src.name AS source_account_name,
  t.transfer_peer_id,
  (peer_tx.id IS NOT NULL) AS matches_transaction,
  (dest_acc.id IS NOT NULL) AS matches_account,
  peer_tx.id AS peer_transaction_id,
  peer_tx.date AS peer_transaction_date,
  peer_tx.type AS peer_transaction_type,
  peer_tx.amount AS peer_transaction_amount,
  peer_src.name AS peer_transaction_account_name,
  dest_acc.id AS destination_account_id,
  dest_acc.name AS destination_account_name,
  CASE
    WHEN src.id IS NULL OR src.user_id IS DISTINCT FROM t.user_id THEN 'INVALID'
    WHEN peer_tx.id IS NOT NULL AND dest_acc.id IS NOT NULL THEN 'AMBIGUOUS'
    WHEN peer_tx.id IS NOT NULL
      AND peer_tx.user_id = t.user_id
      AND peer_tx.transfer_peer_id = t.id
      AND peer_tx.amount = t.amount
      AND peer_tx.account_id IS DISTINCT FROM t.account_id
      THEN 'PEER_TRANSACTION'
    WHEN dest_acc.id IS NOT NULL
      AND dest_acc.user_id = t.user_id
      AND dest_acc.id IS DISTINCT FROM t.account_id
      THEN 'DESTINATION_ACCOUNT'
    WHEN peer_tx.id IS NULL AND dest_acc.id IS NULL THEN 'ORPHAN'
    ELSE 'INVALID'
  END AS classificazione_finale
FROM public.transactions t
LEFT JOIN public.accounts src ON src.id = t.account_id
LEFT JOIN public.transactions peer_tx ON peer_tx.id = t.transfer_peer_id
LEFT JOIN public.accounts peer_src ON peer_src.id = peer_tx.account_id
LEFT JOIN public.accounts dest_acc ON dest_acc.id = t.transfer_peer_id
WHERE t.transfer_peer_id IS NOT NULL
ORDER BY t.user_id, t.date DESC, t.created_at DESC;

-- Q18 riepilogo quantitativo della semantica transfer_peer_id per utente
WITH profilo AS (
  SELECT
    t.user_id,
    CASE
      WHEN src.id IS NULL OR src.user_id IS DISTINCT FROM t.user_id THEN 'INVALID'
      WHEN peer_tx.id IS NOT NULL AND dest_acc.id IS NOT NULL THEN 'AMBIGUOUS'
      WHEN peer_tx.id IS NOT NULL
        AND peer_tx.user_id = t.user_id
        AND peer_tx.transfer_peer_id = t.id
        AND peer_tx.amount = t.amount
        AND peer_tx.account_id IS DISTINCT FROM t.account_id
        THEN 'PEER_TRANSACTION'
      WHEN dest_acc.id IS NOT NULL
        AND dest_acc.user_id = t.user_id
        AND dest_acc.id IS DISTINCT FROM t.account_id
        THEN 'DESTINATION_ACCOUNT'
      WHEN peer_tx.id IS NULL AND dest_acc.id IS NULL THEN 'ORPHAN'
      ELSE 'INVALID'
    END AS classificazione_finale
  FROM public.transactions t
  LEFT JOIN public.accounts src ON src.id = t.account_id
  LEFT JOIN public.transactions peer_tx ON peer_tx.id = t.transfer_peer_id
  LEFT JOIN public.accounts dest_acc ON dest_acc.id = t.transfer_peer_id
  WHERE t.transfer_peer_id IS NOT NULL
)
SELECT
  user_id,
  classificazione_finale,
  COUNT(*) AS numero_movimenti
FROM profilo
GROUP BY user_id, classificazione_finale
ORDER BY user_id, classificazione_finale;

-- ============================================================
-- TOTALI MENSILI CON CRITERI DIVERSI
-- ============================================================

-- Q19 criteri A-D affiancati con differenza rispetto al criterio A
WITH classificati AS (
  SELECT
    t.*,
    DATE_TRUNC('month', t.date)::date AS mese,
    src.id AS src_exists,
    dest_acc.id AS dest_account_id,
    peer_tx.id AS peer_transaction_id,
    CASE
      WHEN t.type = 'transfer'
        AND dest_acc.id IS NOT NULL
        AND dest_acc.user_id = t.user_id
        AND dest_acc.id IS DISTINCT FROM t.account_id
        THEN true
      WHEN t.transfer_peer_id IS NOT NULL
        AND peer_tx.id IS NOT NULL
        AND peer_tx.user_id = t.user_id
        AND peer_tx.transfer_peer_id = t.id
        AND peer_tx.amount = t.amount
        AND peer_tx.account_id IS DISTINCT FROM t.account_id
        THEN true
      ELSE false
    END AS trasferimento_valido
  FROM public.transactions t
  LEFT JOIN public.accounts src ON src.id = t.account_id
  LEFT JOIN public.accounts dest_acc ON dest_acc.id = t.transfer_peer_id
  LEFT JOIN public.transactions peer_tx ON peer_tx.id = t.transfer_peer_id
),
criteri AS (
  SELECT 'A_logica_attuale_aurora' AS criterio, user_id, mese,
         COUNT(*) FILTER (WHERE type = 'income' AND transfer_peer_id IS NULL) AS numero_entrate,
         COALESCE(SUM(amount) FILTER (WHERE type = 'income' AND transfer_peer_id IS NULL), 0) AS totale_entrate,
         COUNT(*) FILTER (WHERE type = 'expense' AND transfer_peer_id IS NULL) AS numero_uscite,
         COALESCE(SUM(amount) FILTER (WHERE type = 'expense' AND transfer_peer_id IS NULL), 0) AS totale_uscite,
         COALESCE(SUM(CASE WHEN type = 'income' AND transfer_peer_id IS NULL THEN amount WHEN type = 'expense' AND transfer_peer_id IS NULL THEN -amount ELSE 0 END), 0) AS netto
  FROM classificati
  GROUP BY user_id, mese
  UNION ALL
  SELECT 'B_escludi_solo_type_transfer' AS criterio, user_id, mese,
         COUNT(*) FILTER (WHERE type = 'income') AS numero_entrate,
         COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) AS totale_entrate,
         COUNT(*) FILTER (WHERE type = 'expense') AS numero_uscite,
         COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS totale_uscite,
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount WHEN type = 'expense' THEN -amount ELSE 0 END), 0) AS netto
  FROM classificati
  WHERE type <> 'transfer'
  GROUP BY user_id, mese
  UNION ALL
  SELECT 'C_escludi_solo_transfer_validi' AS criterio, user_id, mese,
         COUNT(*) FILTER (WHERE type = 'income' AND NOT trasferimento_valido) AS numero_entrate,
         COALESCE(SUM(amount) FILTER (WHERE type = 'income' AND NOT trasferimento_valido), 0) AS totale_entrate,
         COUNT(*) FILTER (WHERE type = 'expense' AND NOT trasferimento_valido) AS numero_uscite,
         COALESCE(SUM(amount) FILTER (WHERE type = 'expense' AND NOT trasferimento_valido), 0) AS totale_uscite,
         COALESCE(SUM(CASE WHEN type = 'income' AND NOT trasferimento_valido THEN amount WHEN type = 'expense' AND NOT trasferimento_valido THEN -amount ELSE 0 END), 0) AS netto
  FROM classificati
  GROUP BY user_id, mese
  UNION ALL
  SELECT 'D_tutti_i_movimenti' AS criterio, user_id, mese,
         COUNT(*) FILTER (WHERE type = 'income') AS numero_entrate,
         COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) AS totale_entrate,
         COUNT(*) FILTER (WHERE type = 'expense') AS numero_uscite,
         COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS totale_uscite,
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount WHEN type = 'expense' THEN -amount ELSE 0 END), 0) AS netto
  FROM classificati
  GROUP BY user_id, mese
),
base_a AS (
  SELECT user_id, mese, netto AS netto_a
  FROM criteri
  WHERE criterio = 'A_logica_attuale_aurora'
)
SELECT
  c.user_id,
  c.mese,
  c.criterio,
  c.numero_entrate,
  c.totale_entrate,
  c.numero_uscite,
  c.totale_uscite,
  c.netto,
  c.netto - COALESCE(a.netto_a, 0) AS differenza_vs_criterio_a
FROM criteri c
LEFT JOIN base_a a ON a.user_id = c.user_id AND a.mese = c.mese
ORDER BY c.user_id, c.mese, c.criterio;

-- Q20 criterio E carta di credito: spese Amex, pagamento Amex, commissioni, differenza
WITH movimenti_carta AS (
  SELECT
    t.*,
    DATE_TRUNC('month', t.date)::date AS mese,
    a.name AS account_name,
    LOWER(COALESCE(t.description, '')) AS descrizione_norm,
    CASE
      WHEN LOWER(a.name) LIKE '%amex%' OR LOWER(a.name) LIKE '%american express%' OR LOWER(a.name) LIKE '%carta%' THEN true
      WHEN LOWER(COALESCE(t.description, '')) LIKE '%american express%' THEN true
      WHEN LOWER(COALESCE(t.description, '')) LIKE '%amex%' THEN true
      ELSE false
    END AS riguarda_amex,
    CASE
      WHEN LOWER(COALESCE(t.description, '')) LIKE '%commissioni%' THEN true
      WHEN LOWER(COALESCE(t.description, '')) LIKE '%commissione%' THEN true
      ELSE false
    END AS possibile_commissione,
    CASE
      WHEN LOWER(COALESCE(t.description, '')) LIKE '%addebito in c/c salvo buon fine%' THEN true
      WHEN LOWER(COALESCE(t.description, '')) LIKE '%american express ita%' THEN true
      WHEN LOWER(COALESCE(t.description, '')) LIKE '%pagamento%amex%' THEN true
      WHEN LOWER(COALESCE(t.description, '')) LIKE '%pagamento%american express%' THEN true
      ELSE false
    END AS possibile_pagamento_carta
  FROM public.transactions t
  JOIN public.accounts a ON a.id = t.account_id
)
SELECT
  user_id,
  mese,
  COUNT(*) FILTER (WHERE riguarda_amex AND type = 'expense' AND NOT possibile_pagamento_carta AND NOT possibile_commissione) AS numero_spese_amex,
  COALESCE(SUM(amount) FILTER (WHERE riguarda_amex AND type = 'expense' AND NOT possibile_pagamento_carta AND NOT possibile_commissione), 0) AS totale_spese_amex,
  COUNT(*) FILTER (WHERE possibile_pagamento_carta) AS numero_pagamenti_amex,
  COALESCE(SUM(amount) FILTER (WHERE possibile_pagamento_carta), 0) AS totale_pagamenti_amex,
  COUNT(*) FILTER (WHERE possibile_commissione) AS numero_commissioni,
  COALESCE(SUM(amount) FILTER (WHERE possibile_commissione), 0) AS totale_commissioni,
  COALESCE(SUM(amount) FILTER (WHERE riguarda_amex AND type = 'expense' AND NOT possibile_pagamento_carta), 0) AS conteggio_senza_pagamento_carta,
  COALESCE(SUM(amount) FILTER (WHERE riguarda_amex AND type = 'expense'), 0) AS conteggio_con_pagamento_carta,
  COALESCE(SUM(amount) FILTER (WHERE possibile_pagamento_carta), 0) AS differenza_con_senza_pagamento
FROM movimenti_carta
WHERE riguarda_amex OR possibile_commissione OR possibile_pagamento_carta
GROUP BY user_id, mese
ORDER BY user_id, mese;

-- ============================================================
-- PAGAMENTI CARTA E DOPPIO CONTEGGIO
-- ============================================================

-- Q21 possibili coppie BancoPosta -> American Express entro 5 giorni
WITH bp AS (
  SELECT
    t.id,
    t.user_id,
    t.date,
    t.type,
    t.amount,
    t.description,
    t.transfer_peer_id,
    a.name AS account_name
  FROM public.transactions t
  JOIN public.accounts a ON a.id = t.account_id
  WHERE
    (
      LOWER(a.name) LIKE '%banco%'
      OR LOWER(a.name) LIKE '%posta%'
      OR LOWER(a.name) LIKE '%bancoposta%'
      OR LOWER(COALESCE(t.description, '')) LIKE '%american express ita%'
      OR LOWER(COALESCE(t.description, '')) LIKE '%amex%'
    )
    AND (
      LOWER(COALESCE(t.description, '')) LIKE '%american express%'
      OR LOWER(COALESCE(t.description, '')) LIKE '%amex%'
      OR LOWER(COALESCE(t.description, '')) LIKE '%carta%'
    )
),
amex AS (
  SELECT
    t.id,
    t.user_id,
    t.date,
    t.type,
    t.amount,
    t.description,
    t.transfer_peer_id,
    a.name AS account_name
  FROM public.transactions t
  JOIN public.accounts a ON a.id = t.account_id
  WHERE
    LOWER(a.name) LIKE '%amex%'
    OR LOWER(a.name) LIKE '%american express%'
    OR LOWER(a.name) LIKE '%carta%'
    OR LOWER(COALESCE(t.description, '')) LIKE '%addebito in c/c salvo buon fine%'
)
SELECT
  bp.user_id,
  bp.date AS data_movimento_bancoposta,
  amex.date AS data_movimento_amex,
  bp.amount AS importo_bancoposta,
  amex.amount AS importo_amex,
  bp.description AS descrizione_bancoposta,
  amex.description AS descrizione_amex,
  bp.type AS tipo_bancoposta,
  amex.type AS tipo_amex,
  bp.account_name AS account_bancoposta,
  amex.account_name AS account_amex,
  bp.transfer_peer_id AS peer_bancoposta,
  amex.transfer_peer_id AS peer_amex,
  ABS(bp.date - amex.date) AS distanza_giorni,
  CASE
    WHEN ABS(bp.amount - amex.amount) <= 0.01 AND ABS(bp.date - amex.date) <= 2 THEN 'ALTA'
    WHEN ABS(bp.amount - amex.amount) <= 0.01 AND ABS(bp.date - amex.date) <= 5 THEN 'MEDIA'
    WHEN ABS(bp.amount - amex.amount) <= 1.00 AND ABS(bp.date - amex.date) <= 5 THEN 'BASSA'
    ELSE 'DEBOLE'
  END AS probabilita_stesso_evento
FROM bp
JOIN amex ON amex.user_id = bp.user_id
  AND amex.id <> bp.id
  AND ABS(bp.amount - amex.amount) <= 1.00
  AND ABS(bp.date - amex.date) <= 5
ORDER BY bp.user_id, bp.date DESC, bp.amount DESC;

-- Q22 movimenti carta sospetti non accoppiati nella query precedente
SELECT
  t.user_id,
  t.id,
  t.date,
  t.type,
  t.amount,
  t.description,
  a.name AS account_name,
  t.transfer_peer_id,
  CASE
    WHEN LOWER(COALESCE(t.description, '')) LIKE '%commissioni%' THEN 'COMMISSIONE_CARTA'
    WHEN LOWER(COALESCE(t.description, '')) LIKE '%commissione%' THEN 'COMMISSIONE_CARTA'
    WHEN LOWER(COALESCE(t.description, '')) LIKE '%rimborso%' AND (LOWER(COALESCE(t.description, '')) LIKE '%amex%' OR LOWER(COALESCE(t.description, '')) LIKE '%american express%' OR LOWER(a.name) LIKE '%carta%') THEN 'RIMBORSO_CARTA'
    WHEN LOWER(COALESCE(t.description, '')) LIKE '%saldo%' AND LOWER(a.name) LIKE '%carta%' THEN 'SALDO_CARTA'
    WHEN LOWER(COALESCE(t.description, '')) LIKE '%american express%' OR LOWER(COALESCE(t.description, '')) LIKE '%amex%' THEN 'PAGAMENTO_O_MOVIMENTO_AMEX'
    WHEN LOWER(a.name) LIKE '%carta%' THEN 'MOVIMENTO_CONTO_CARTA'
    ELSE 'ALTRO_SOSPETTO'
  END AS classificazione_sospetto
FROM public.transactions t
JOIN public.accounts a ON a.id = t.account_id
WHERE
  LOWER(a.name) LIKE '%carta%'
  OR LOWER(a.name) LIKE '%amex%'
  OR LOWER(a.name) LIKE '%american express%'
  OR LOWER(COALESCE(t.description, '')) LIKE '%american express%'
  OR LOWER(COALESCE(t.description, '')) LIKE '%amex%'
  OR LOWER(COALESCE(t.description, '')) LIKE '%commissioni domiciliazione%'
  OR LOWER(COALESCE(t.description, '')) LIKE '%addebito in c/c salvo buon fine%'
ORDER BY t.user_id, t.date DESC, t.created_at DESC;

-- ============================================================
-- SALDI INIZIALI
-- ============================================================

-- Q23 saldo iniziale implicito per conto con prime transazioni e movimenti sospetti
WITH effetti AS (
  SELECT
    t.user_id,
    t.account_id,
    t.date,
    CASE
      WHEN t.type = 'income' THEN t.amount
      WHEN t.type = 'expense' THEN -t.amount
      WHEN t.type = 'transfer' THEN -t.amount
      ELSE 0
    END AS delta,
    CASE WHEN t.type = 'income' AND t.transfer_peer_id IS NULL THEN t.amount ELSE 0 END AS entrate,
    CASE WHEN t.type = 'expense' AND t.transfer_peer_id IS NULL THEN t.amount ELSE 0 END AS uscite,
    CASE WHEN t.type = 'transfer' THEN t.amount ELSE 0 END AS transfer_out,
    0::numeric AS transfer_in
  FROM public.transactions t
  UNION ALL
  SELECT
    t.user_id,
    dest.id AS account_id,
    t.date,
    t.amount AS delta,
    0::numeric AS entrate,
    0::numeric AS uscite,
    0::numeric AS transfer_out,
    t.amount AS transfer_in
  FROM public.transactions t
  JOIN public.accounts dest ON dest.id = t.transfer_peer_id
  WHERE t.type = 'transfer'
),
prime AS (
  SELECT
    account_id,
    MIN(date) AS prima_data_movimento
  FROM public.transactions
  GROUP BY account_id
),
sospetti AS (
  SELECT
    account_id,
    COUNT(*) AS numero_movimenti_saldo_iniziale,
    ARRAY_AGG(id ORDER BY date, created_at) AS movimenti_saldo_iniziale
  FROM public.transactions
  WHERE
    LOWER(COALESCE(description, '')) LIKE '%saldo iniziale%'
    OR LOWER(COALESCE(description, '')) LIKE '%iniziale%'
    OR LOWER(COALESCE(description, '')) LIKE '%apertura%'
    OR LOWER(COALESCE(description, '')) LIKE '%riporto%'
  GROUP BY account_id
)
SELECT
  a.user_id,
  a.id AS account_id,
  a.name AS account_name,
  a.type AS account_type,
  a.created_at::date AS data_creazione_conto,
  a.balance AS saldo_attuale_memorizzato,
  p.prima_data_movimento,
  COALESCE(SUM(e.entrate), 0) AS somma_entrate,
  COALESCE(SUM(e.uscite), 0) AS somma_uscite,
  COALESCE(SUM(e.transfer_in), 0) AS trasferimenti_in_entrata,
  COALESCE(SUM(e.transfer_out), 0) AS trasferimenti_in_uscita,
  COALESCE(SUM(e.delta), 0) AS saldo_netto_ricostruito,
  a.balance - COALESCE(SUM(e.delta), 0) AS possibile_saldo_iniziale_implicito,
  COALESCE(s.numero_movimenti_saldo_iniziale, 0) AS numero_movimenti_saldo_iniziale,
  s.movimenti_saldo_iniziale
FROM public.accounts a
LEFT JOIN effetti e ON e.user_id = a.user_id AND e.account_id = a.id
LEFT JOIN prime p ON p.account_id = a.id
LEFT JOIN sospetti s ON s.account_id = a.id
GROUP BY a.user_id, a.id, a.name, a.type, a.created_at, a.balance, p.prima_data_movimento, s.numero_movimenti_saldo_iniziale, s.movimenti_saldo_iniziale
ORDER BY a.user_id, a.name;

-- Q24 prime transazioni cronologiche di ogni conto
SELECT
  ranked.user_id,
  ranked.account_id,
  a.name AS account_name,
  ranked.rn AS ordine_movimento,
  ranked.id AS transaction_id,
  ranked.date,
  ranked.type,
  ranked.amount,
  ranked.description,
  ranked.transfer_peer_id,
  ranked.created_at
FROM (
  SELECT
    t.*,
    ROW_NUMBER() OVER (PARTITION BY t.account_id ORDER BY t.date, t.created_at, t.id) AS rn
  FROM public.transactions t
) ranked
JOIN public.accounts a ON a.id = ranked.account_id
WHERE ranked.rn <= 5
ORDER BY ranked.user_id, a.name, ranked.rn;

-- ============================================================
-- DUPLICATI
-- ============================================================

-- Q25 duplicati certi: descrizione normalizzata identica
SELECT
  user_id,
  account_id,
  date,
  type,
  amount,
  LOWER(REGEXP_REPLACE(TRIM(COALESCE(description, '')), '\s+', ' ', 'g')) AS descrizione_normalizzata,
  COUNT(*) AS occorrenze,
  ARRAY_AGG(id ORDER BY created_at) AS transaction_ids
FROM public.transactions
GROUP BY user_id, account_id, date, type, amount, LOWER(REGEXP_REPLACE(TRIM(COALESCE(description, '')), '\s+', ' ', 'g'))
HAVING COUNT(*) > 1
ORDER BY occorrenze DESC, date DESC;

-- Q26 duplicati probabili: stessa chiave import debole e descrizione normalizzata simile per prefisso
WITH norm AS (
  SELECT
    id,
    user_id,
    account_id,
    date,
    type,
    amount,
    description,
    LOWER(REGEXP_REPLACE(TRIM(COALESCE(description, '')), '[^a-zA-Z0-9]+', ' ', 'g')) AS descrizione_norm
  FROM public.transactions
)
SELECT
  a.user_id,
  a.account_id,
  a.date,
  a.type,
  a.amount,
  a.id AS transaction_a,
  b.id AS transaction_b,
  a.description AS descrizione_a,
  b.description AS descrizione_b,
  CASE
    WHEN LEFT(a.descrizione_norm, 20) = LEFT(b.descrizione_norm, 20) THEN 'prefisso_20_uguale'
    WHEN LEFT(a.descrizione_norm, 12) = LEFT(b.descrizione_norm, 12) THEN 'prefisso_12_uguale'
    WHEN POSITION(a.descrizione_norm IN b.descrizione_norm) > 0 OR POSITION(b.descrizione_norm IN a.descrizione_norm) > 0 THEN 'una_descrizione_contiene_altra'
    ELSE 'stessa_chiave_import_descrizione_diversa'
  END AS motivo_probabile
FROM norm a
JOIN norm b ON b.user_id = a.user_id
  AND b.account_id = a.account_id
  AND b.date = a.date
  AND b.type = a.type
  AND b.amount = a.amount
  AND b.id > a.id
WHERE
  LEFT(a.descrizione_norm, 12) = LEFT(b.descrizione_norm, 12)
  OR POSITION(a.descrizione_norm IN b.descrizione_norm) > 0
  OR POSITION(b.descrizione_norm IN a.descrizione_norm) > 0
ORDER BY a.user_id, a.date DESC, a.amount DESC;

-- Q27 falsi duplicati potenziali esclusi da deduplica debole account-data-importo
SELECT
  user_id,
  account_id,
  date,
  amount,
  COUNT(*) AS movimenti_stessa_chiave_debole,
  COUNT(DISTINCT type) AS tipi_distinti,
  COUNT(DISTINCT LOWER(REGEXP_REPLACE(TRIM(COALESCE(description, '')), '\s+', ' ', 'g'))) AS descrizioni_distinte,
  ARRAY_AGG(id ORDER BY created_at) AS transaction_ids,
  ARRAY_AGG(description ORDER BY created_at) AS descrizioni
FROM public.transactions
GROUP BY user_id, account_id, date, amount
HAVING COUNT(*) > 1
  AND COUNT(DISTINCT LOWER(REGEXP_REPLACE(TRIM(COALESCE(description, '')), '\s+', ' ', 'g'))) > 1
ORDER BY movimenti_stessa_chiave_debole DESC, date DESC;

-- Q28 conteggio mensile dei falsi duplicati potenziali
WITH chiavi AS (
  SELECT
    user_id,
    account_id,
    date,
    amount,
    COUNT(*) AS n,
    COUNT(DISTINCT LOWER(REGEXP_REPLACE(TRIM(COALESCE(description, '')), '\s+', ' ', 'g'))) AS descrizioni_distinte
  FROM public.transactions
  GROUP BY user_id, account_id, date, amount
)
SELECT
  user_id,
  DATE_TRUNC('month', date)::date AS mese,
  COUNT(*) AS chiavi_deboli_con_piu_movimenti,
  SUM(n) AS movimenti_coinvolti,
  SUM(n - 1) AS movimenti_che_un_import_debole_potrebbe_escludere
FROM chiavi
WHERE n > 1 AND descrizioni_distinte > 1
GROUP BY user_id, DATE_TRUNC('month', date)::date
ORDER BY user_id, mese;
