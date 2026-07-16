# Piano di correzione Aurora 5.0

Questo piano non è stato applicato. È una proposta operativa dopo audit.

## Interventi critici

1. Backup produzione
   - Esportare dump Supabase completo.
   - Esportare JSON Aurora da Impostazioni.
   - Salvare export originale NotaFacile.

2. Decidere modello unico dei trasferimenti
   - Opzione raccomandata: una riga `type='transfer'` con campo separato `destination_account_id`.
   - Non riusare `transfer_peer_id` per due semantiche diverse.
   - Aggiungere migration che introduce `destination_account_id` e migra i dati.

3. Normalizzare trasferimenti storici
   - Classificare righe con `transfer_peer_id` verso conto.
   - Classificare righe con `transfer_peer_id` verso transazione.
   - Collegare coppie old-model oppure trasformarle in un singolo transfer canonico.

4. Introdurre saldo iniziale esplicito
   - Campo `opening_balance` o tabella `account_opening_balances`.
   - Impedire che il saldo iniziale venga contato nei report mensili come entrata.

5. Centralizzare i report
   - Creare view/RPC read-only per totali mensili.
   - Dashboard, report, budget e transazioni devono usare lo stesso criterio.

## Interventi ad alto rischio

1. Data cleanup
   - Applicare solo dopo riconciliazione con NotaFacile.
   - Ogni correzione deve produrre log prima/dopo.
   - Evitare modifiche massive senza rollback testato.

2. Pagamenti carta
   - Definire criterio contabile:
     - spese reali = movimenti carta;
     - pagamento carta = transfer da conto corrente a conto carta.
   - Rilevare e convertire pagamenti carta importati come expense.

3. Importi e date
   - Parser unico per numeri italiani/internazionali.
   - Parser data esplicito per NotaFacile.
   - Matching con tolleranza date.

4. Vincoli database
   - `CHECK type IN (...)`.
   - `CHECK amount > 0`.
   - `CHECK month BETWEEN 1 AND 12`.
   - FK `destination_account_id` quando introdotta.

## Miglioramenti

1. Import NotaFacile dedicato
   - Pagina `/audit-contabile` o `/settings/reconciliation`.
   - Upload CSV/XLSX.
   - Anteprima mapping colonne.
   - Riconoscimento trasferimenti e pagamenti carta.
   - Nessun salvataggio automatico prima della riconciliazione.

2. Chiave import
   - Aggiungere `external_source`, `external_id`, `import_batch_id`, `raw_hash`.
   - Deduplica robusta su hash normalizzato.

3. Audit report
   - Pagina read-only con scostamenti mese.
   - Drill-down su movimenti presenti solo in uno dei due sistemi.

4. UI
   - Mostrare chiaramente se un movimento è transfer, saldo iniziale, importato o manuale.

## Test minimi

### RPC e API

- creazione entrata aumenta saldo una volta;
- creazione uscita diminuisce saldo una volta;
- creazione transfer non altera patrimonio totale;
- modifica entrata in uscita;
- modifica uscita in transfer;
- cancellazione transfer;
- rollback su account destinazione non valido;
- categoria di altro utente rifiutata;
- trasferimento verso conto di altro utente rifiutato;
- concorrenza su stesso conto.

### Report

- fine mese;
- cambio anno;
- febbraio bisestile;
- transfer esclusi correttamente;
- income/expense con peer storico gestiti secondo criterio scelto;
- categoria padre/sottocategoria;
- saldo iniziale escluso dai totali mensili.

### Import

- importo `1.234,56`;
- importo `1,234.56`;
- importi negativi;
- date `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`;
- duplicati reali;
- due operazioni distinte stesso giorno/importo;
- pagamento carta;
- giroconto investimento/previdenza;
- file NotaFacile reale.

## Strategia di backup

1. Dump Supabase prima di ogni migration dati.
2. Export JSON Aurora.
3. Export CSV mensile da NotaFacile.
4. Snapshot query Q7-Q12 prima della correzione.
5. Snapshot query Q7-Q12 dopo correzione.

## Procedura di riconciliazione

1. Eseguire `audit/diagnostica_contabile.sql`.
2. Importare export NotaFacile in staging temporaneo.
3. Normalizzare descrizioni:
   - minuscolo;
   - spazi multipli rimossi;
   - accenti normalizzati;
   - merchant ricorrenti normalizzati.
4. Matching esatto:
   - stesso conto;
   - stessa data;
   - stesso importo assoluto;
   - descrizione simile.
5. Matching fuzzy:
   - tolleranza data ±3 giorni;
   - tolleranza importo 0,01;
   - similarità descrizione;
   - categoria compatibile.
6. Classificare differenze:
   - solo NotaFacile;
   - solo Aurora;
   - possibile duplicato;
   - segno invertito;
   - transfer classificato diversamente;
   - saldo iniziale.
7. Produrre piano dati per mese.
8. Applicare correzioni solo dopo approvazione.

## Procedura di rollback

1. Ripristino dump Supabase se una migration dati produce scostamenti.
2. Se si usa migration reversibile, preparare migration inversa testata su staging.
3. Conservare tabella/log di mapping vecchio-id -> nuovo-id.
4. Non cancellare dati storici senza archivio `raw_import_rows`.
5. Validare rollback rieseguendo Q7-Q12.

## Funzione di riconciliazione proposta

Pagina futura: `/audit-contabile`.

Flusso:

1. Upload CSV/XLSX NotaFacile.
2. Rilevamento colonne e mapping guidato.
3. Normalizzazione righe in memoria.
4. Confronto con Aurora per periodo.
5. Tabelle:
   - totale NotaFacile;
   - totale Aurora criterio corrente;
   - differenza;
   - movimenti mancanti;
   - possibili duplicati;
   - possibili match fuzzy;
   - trasferimenti sospetti;
   - saldi iniziali.
6. Esportazione report di riconciliazione.

Algoritmo matching:

- score data: 1.0 se stessa data, decresce fino a ±5 giorni;
- score importo: 1.0 se differenza <= 0,01;
- score descrizione: token set ratio su descrizione normalizzata;
- score conto: 1.0 se stesso conto o alias noto;
- score categoria: bonus se categoria/parent compatibile;
- classificazione:
  - `match_certo` score >= 0,92;
  - `match_probabile` score 0,75-0,91;
  - `match_debole` score 0,55-0,74;
  - `nessun_match` sotto 0,55.
