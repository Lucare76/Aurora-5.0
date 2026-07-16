# Diagnosi differenze NotaFacile vs Aurora 5.0

## Verifica storica di `transfer_peer_id`

### Ricostruzione migration per migration

| Migration | Tipo colonna | FK originale/attuale | Significato previsto | Uso RPC | Uso frontend/report |
|---|---|---|---|---|---|
| `00001_initial_schema.sql` | `uuid` | FK verso `public.transactions(id) on delete set null` | ID della transazione peer in un modello a due righe | Non ancora atomico; helper saldo separato | Coerente con vecchio modello peer transaction |
| `00002_financial_atomic_functions.sql` | `uuid` invariato | FK ancora verso `transactions(id)` | Lo schema dice peer transaction | `create_transaction_atomic` salva `p_destination_account_id` dentro `transfer_peer_id`; `delete/update` trattano quel valore come conto destinazione | Inizio conflitto: DB dice transazione, RPC usa conto |
| `00003_fix_atomic_functions.sql` | `uuid` invariato | FK ancora non rimossa in questa migration | Teoricamente ancora peer transaction | Conferma uso come conto destinazione nelle RPC; corregge ownership e revoca `adjust_account_balance` | Report continuano a usare presenza di `transfer_peer_id` come criterio di esclusione |
| `00009_fix_transfer_peer_id_fkey.sql` | `uuid` libero | FK rimossa | Campo polisemico: vecchie righe possono contenere transazione, nuove righe conto | Coerente con RPC new-model a una riga | Frontend prova a supportare entrambe; report non distinguono e filtrano solo `transfer_peer_id IS NULL` |
| Migration successive | `uuid` libero | Nessuna nuova FK rilevata | Nessuna normalizzazione dati | Nessun cambio RPC transfer rilevato | Persistono criteri misti |

### Risposte esplicite

1. Oggi `transfer_peer_id` può contenere sia un ID conto sia un ID transazione. Il codice corrente delle RPC lo usa come ID conto destinazione per i nuovi transfer.
2. I record storici creati prima della migration 00009, o creati da vecchie UI/import manuali a due righe, potrebbero contenere il vecchio significato: ID transazione peer.
3. I record recenti creati via `/api/transactions` e `create_transaction_atomic` possono contenere il nuovo significato: ID conto destinazione.
4. Dashboard e report non interpretano correttamente entrambi. Escludono ogni income/expense con `transfer_peer_id`, indipendentemente dal fatto che sia peer transaction, conto destinazione o valore anomalo.
5. La foreign key attuale è assente; questo è coerente col codice RPC nuovo, ma lascia non garantita la validità del riferimento.
6. Sì, esistono componenti che riconoscono ancora la vecchia semantica: `transactions/page.tsx` cerca una transazione peer e poi fa fallback su account destinazione. Report e hook usano invece una semantica semplificata: presenza del campo = escludi.

## Ipotesi ordinate per probabilità

### 1. Differenza di criterio sui trasferimenti e pagamenti carta

Probabilità: molto alta.

Evidenze:

- `supabase/migrations/00009_fix_transfer_peer_id_fkey.sql` dichiara che `transfer_peer_id` ora salva l'UUID del conto destinatario, mentre il vecchio modello salvava l'UUID della transazione gemella.
- `src/hooks/use-transactions.ts:49` e `src/hooks/use-transactions.ts:54` escludono ogni transazione con `transfer_peer_id` dai totali.
- `src/app/(app)/reports/page.tsx:223` e `src/app/(app)/reports/page.tsx:227` usano lo stesso criterio.
- `src/app/(app)/import-estratti/page.tsx:369` rileva pagamenti American Express e li trasforma in giroconti.

Metodo per confermare:

1. Eseguire Q3, Q4, Q7, Q8, Q9, Q10 in `audit/diagnostica_contabile.sql`.
2. Confrontare per mese:
   - totale con tutte le entrate/uscite;
   - totale escludendo `transfer_peer_id`;
   - totale escludendo solo `type='transfer'`.
3. Verificare quale criterio coincide con NotaFacile.

Query principali: Q3, Q4, Q10, Q14.

### 2. Import NotaFacile eseguito fuori dal repository

Probabilità: alta.

Evidenze:

- Nessuna occorrenza di `NotaFacile` nel repository.
- Gli importatori presenti sono Bancoposta/Amex e CSV Aurora, non NotaFacile.
- `supabase/seed.sql` non contiene dati storici.

Metodo per confermare:

1. Recuperare file sorgente NotaFacile.
2. Recuperare eventuali script locali o query SQL usate per import.
3. Confrontare `created_at` delle transazioni importate: batch con stesso timestamp suggeriscono import massivo.

Query principali: Q6, Q7, Q10.

### 3. Pagamento carta contato diversamente

Probabilità: alta.

Evidenze:

- Importatore specifico riconosce Amex (`BP_AMEX_PAY_RE`, `AMEX_BP_PAY_RE`) e crea giroconti.
- Se NotaFacile conta spese carta nel mese di competenza e pagamento carta nel conto corrente come transfer, coincide con Aurora solo se anche Aurora classifica correttamente tutte le spese carta e il pagamento.
- Se l'import NotaFacile ha importato pagamento carta come `expense`, Aurora può sovrastimare le uscite.

Metodo per confermare:

1. Eseguire Q14.
2. Per ogni mese con pagamento carta confrontare:
   - totale spese su conto carta;
   - pagamento carta sul conto corrente;
   - differenza NotaFacile-Aurora.

Query principali: Q14, Q10.

### 4. Saldi iniziali importati come movimenti

Probabilità: alta.

Evidenze:

- Tabella `accounts` ha solo `balance`, non `initial_balance`.
- La pagina conti scrive direttamente il saldo nel record conto.
- Le query/report contano qualunque income/expense senza `transfer_peer_id`.

Metodo per confermare:

1. Eseguire Q5 per descrizioni contenenti "saldo iniziale".
2. Eseguire Q11 per calcolare saldo iniziale implicito.
3. Verificare mesi iniziali del periodo storico.

Query principali: Q5, Q11, Q12.

### 5. Deduplica insufficiente o eccessiva

Probabilità: alta.

Evidenze:

- `import-estratti` deduplica solo su conto, data, importo.
- CSV generico in `transactions/page.tsx` non deduplica.
- Nessun vincolo univoco DB su chiave import.

Metodo per confermare:

1. Eseguire Q1 e Q2.
2. Ordinare per mese e account.
3. Verificare casi con stesso importo/data ma descrizioni diverse.

Query principali: Q1, Q2, Q6.

### 6. Parsing importi NotaFacile

Probabilità: media-alta.

Evidenze:

- Parser Bancoposta gestisce `1.234,56`.
- Parser Amex interpreta importo firmato e inverte segno: importo negativo diventa `income`.
- CSV Aurora generico usa `parseFloat(str.replace(',', '.'))`; un valore `1.234,56` diventa `1.234`, non `1234.56`.

Metodo per confermare:

1. Esaminare formato importi NotaFacile.
2. Cercare importi sospetti con centesimi persi o importi piccoli.
3. Confrontare distribuzione importi tra NotaFacile e Aurora.

Query principali: Q1, Q7, Q10; serve file sorgente NotaFacile.

### 7. Date diverse

Probabilità: media.

Evidenze:

- Bancoposta usa "Data Contabile".
- Amex usa formato `MM/DD/YYYY`.
- NotaFacile potrebbe usare data valuta o data operazione.

Metodo per confermare:

1. Confrontare movimenti a cavallo mese.
2. Matching con tolleranza ±3/±5 giorni.
3. Verificare fine mese, anno e febbraio.

Query principali: Q7, Q10; serve export NotaFacile.

### 8. Categorie perse o errate

Probabilità: media.

Evidenze:

- Import CSV mappa categoria per nome semplice, non parent/child.
- Categorie duplicate o parent errato possono trasformare righe in "Senza categoria".

Metodo per confermare:

1. Eseguire Q13 e Q15.
2. Controllare movimenti senza categoria in Q7.
3. Confrontare report per categoria NotaFacile.

### 9. Prestiti o ricorrenti non contabilizzati come NotaFacile

Probabilità: media-bassa.

Evidenze:

- Prestiti e pagamenti prestito non generano transazioni contabili.
- Ricorrenti auto-create dipendono da cron endpoint.

Metodo per confermare:

1. Verificare se NotaFacile include prestiti nel cash-flow mensile.
2. Controllare ricorrenze con `auto_create=true` e `last_run_date`.

### 10. Errori storici da vecchie versioni RPC/UI

Probabilità: media.

Evidenze:

- Migration 00002 e 00003 cambiano funzioni finanziarie.
- Prima della correzione, la UI aveva flussi manuali client-side per saldi e transazioni.

Metodo per confermare:

1. Eseguire Q11 e Q12.
2. Cercare mismatch tra saldo memorizzato e movimenti.
3. Controllare timestamp prima/dopo deployment.

## File e righe coinvolti

- `src/hooks/use-transactions.ts:49-54`: criterio mensile esclude `transfer_peer_id`.
- `src/app/(app)/reports/page.tsx:223-239`: totali report escludono `transfer_peer_id`.
- `src/app/(app)/reports/page.tsx:300`: time series ignora righe con peer.
- `src/app/(app)/transactions/page.tsx:403-417`: riepilogo mese pagina transazioni esclude righe con peer.
- `src/app/(app)/transactions/page.tsx:623-656`: import CSV Aurora, parsing importi/date.
- `src/app/(app)/import-estratti/page.tsx:84-101`: parsing date Bancoposta/Amex.
- `src/app/(app)/import-estratti/page.tsx:365-395`: riconoscimento pagamento Amex.
- `src/app/(app)/import-estratti/page.tsx:430 circa`: deduplica su conto/data/importo.
- `src/app/api/transactions/route.ts:90`, `:137`, `:183`: chiamate RPC atomiche.
- `supabase/migrations/00003_fix_atomic_functions.sql:10`, `:126`, `:279`: RPC correnti.
- `supabase/migrations/00009_fix_transfer_peer_id_fkey.sql`: rimozione FK e semantica mista.

## Dati necessari da NotaFacile

Servono almeno:

- export completo CSV/XLSX;
- data operazione;
- data contabile;
- data valuta;
- conto;
- descrizione originale;
- importo firmato;
- categoria;
- indicazione giroconto/trasferimento;
- identificativo movimento se esiste;
- saldo conto iniziale e finale per mese;
- criterio NotaFacile sui pagamenti carta.

## Esempio di riconciliazione mese per mese

| Mese | NotaFacile entrate | Aurora criterio A | Aurora criterio B | Differenza | Ipotesi |
|---|---:|---:|---:|---:|---|
| 2025-01 | 2.500,00 | 2.500,00 | 2.500,00 | 0,00 | ok |
| 2025-02 | 2.500,00 | 2.500,00 | 3.200,00 | 700,00 | possibile rimborso/transfer contato |
| 2025-03 | -1.900,00 uscite | -1.200,00 | -1.900,00 | 700,00 | pagamento carta escluso da Aurora |

Usare Q10 per produrre i criteri Aurora e poi affiancare i totali NotaFacile.

## Conclusione diagnostica

La causa piu probabile non è una singola somma errata nella dashboard, ma una combinazione di:

1. semantica ibrida dei trasferimenti;
2. criterio report `!transfer_peer_id`;
3. import NotaFacile non tracciato;
4. possibile doppia contabilizzazione o esclusione dei pagamenti carta;
5. saldi iniziali non modellati esplicitamente.

## Procedura di riconciliazione reale

### 1. Query da eseguire per prime

Esegui nel Supabase SQL Editor, una query alla volta, in questo ordine:

1. Q17 `profilo completo di ogni transfer_peer_id valorizzato`.
2. Q18 `riepilogo quantitativo della semantica transfer_peer_id per utente`.
3. Q19 `criteri A-D affiancati`.
4. Q20 `criterio E carta di credito`.
5. Q23 `saldo iniziale implicito per conto`.
6. Q25, Q27, Q28 sui duplicati certi/falsi duplicati potenziali.

Queste query sono tutte read-only e usano solo `SELECT`/`WITH`.

### 2. Risultati da copiare

Copia in CSV o screenshot/tabella:

- da Q18: conteggi per `PEER_TRANSACTION`, `DESTINATION_ACCOUNT`, `AMBIGUOUS`, `ORPHAN`, `INVALID`;
- da Q19: almeno 12 mesi con `criterio`, `netto`, `differenza_vs_criterio_a`;
- da Q20: mesi con `totale_pagamenti_amex` diverso da zero;
- da Q23: conti con `possibile_saldo_iniziale_implicito` diverso da zero;
- da Q28: mesi con `movimenti_che_un_import_debole_potrebbe_escludere` maggiore di zero.

### 3. Come scegliere un mese campione

Scegli un mese in cui:

- NotaFacile e Aurora differiscono molto;
- Q19 mostra differenza significativa tra criterio A e B/C/D;
- oppure Q20 mostra pagamento Amex alto;
- oppure Q23 indica saldo iniziale implicito nel periodo iniziale;
- oppure Q28 mostra rischio duplicati.

Se ci sono più mesi, scegli prima quello con differenza assoluta maggiore tra NotaFacile e Aurora.

### 4. Come confrontare il mese campione con NotaFacile

Per il mese scelto prepara una tabella:

| Voce | NotaFacile | Aurora criterio A | Aurora criterio B | Aurora criterio C | Aurora criterio D |
|---|---:|---:|---:|---:|---:|
| Entrate | | | | | |
| Uscite | | | | | |
| Netto | | | | | |

Poi aggiungi:

- pagamento carta del mese da Q20/Q21;
- saldo iniziale implicito se il mese è il primo storico;
- duplicati/falsi duplicati da Q25-Q28;
- movimenti con `ORPHAN` o `INVALID` da Q17.

### 5. Come capire la causa della differenza

#### Trasferimenti

Segnale forte:

- Q18 mostra record `PEER_TRANSACTION` e `DESTINATION_ACCOUNT` nello stesso utente;
- Q19 criterio B o C si avvicina a NotaFacile più del criterio A;
- Q17 mostra `income`/`expense` con `transfer_peer_id`.

Interpretazione: Aurora sta escludendo movimenti che NotaFacile conta, oppure viceversa.

#### Carta di credito

Segnale forte:

- Q20 mostra `totale_pagamenti_amex` vicino alla differenza mensile;
- Q21 trova coppie BancoPosta/Amex con probabilità `ALTA` o `MEDIA`;
- il mese contiene sia spese Amex sia pagamento Amex.

Interpretazione: pagamento carta trattato come spesa reale in un sistema e come transfer nell'altro.

#### Saldo iniziale

Segnale forte:

- Q23 mostra `possibile_saldo_iniziale_implicito` elevato;
- Q24 mostra prime transazioni con descrizioni tipo saldo/apertura/riporto;
- la differenza appare nei primi mesi storici.

Interpretazione: saldo iniziale importato come movimento o applicato due volte.

#### Duplicati

Segnale forte:

- Q25 ha righe;
- Q27/Q28 indicano molti movimenti con stessa chiave debole account-data-importo ma descrizione diversa.

Interpretazione: deduplica debole può avere escluso movimenti reali o lasciato duplicati.

#### Date

Segnale forte:

- differenza di un mese si compensa nel mese precedente/successivo;
- movimenti NotaFacile a fine mese sono in Aurora a inizio mese successivo o viceversa.

Interpretazione: data contabile/data valuta o parsing formato data.

#### Movimenti mancanti

Segnale forte:

- nessun criterio A-D si avvicina a NotaFacile;
- Q20/Q23/Q28 non spiegano la differenza;
- confronto riga per riga mostra record presenti solo in NotaFacile.

Interpretazione: import iniziale incompleto o filtro/deduplica errato.

### 6. Quando sarà sicuro correggere i dati

Solo quando:

1. almeno un mese campione è riconciliato riga per riga;
2. la stessa ipotesi spiega almeno 2-3 mesi;
3. esiste backup Supabase completo;
4. esiste export NotaFacile originale conservato;
5. le query Q17-Q28 sono state salvate prima della correzione;
6. è chiaro quale modello transfer definitivo usare.

### 7. Backup prima di qualunque correzione

Prima di qualsiasi modifica futura:

1. dump Supabase completo;
2. export JSON Aurora da Impostazioni;
3. export CSV delle transazioni;
4. export NotaFacile originale;
5. risultati Q17-Q28 salvati in CSV;
6. screenshot dei totali mensili NotaFacile per i mesi campione.
