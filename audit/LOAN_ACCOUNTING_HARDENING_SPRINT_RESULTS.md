# Loan Accounting Hardening — Sprint Results

Data: 17 settembre 2026
Branch: `feat/loan-accounting-hardening`

## Obiettivo

Rendere la gestione dei pagamenti prestiti coerente a livello database, eliminando il rischio che `loan_payments` e `loans.remaining` divergano in caso di errore client, update parziale o sovrapagamento.

## Problemi rilevati prima dello sprint

La pagina Prestiti registrava un pagamento con due operazioni separate:

1. `INSERT` in `loan_payments`;
2. `UPDATE` successivo di `loans.remaining` / `is_settled`.

Se la seconda operazione falliva, il pagamento restava registrato ma il residuo poteva rimanere errato. Inoltre l'importo del pagamento non era limitato al capitale residuo e la modifica dell'importo originario del prestito poteva rendere incoerente il residuo rispetto ai pagamenti gia registrati.

## Implementazione

### Migration `00040_loan_accounting_hardening.sql`

Aggiunti:

- vincolo `loans.amount > 0`;
- vincolo `0 <= loans.remaining <= loans.amount`;
- vincolo `loan_payments.amount > 0`;
- trigger `validate_loan_payment_mutation` che:
  - verifica ownership prestito/pagamento;
  - blocca importi non positivi;
  - blocca il sovrapagamento;
- trigger `sync_loan_from_payments` che ricalcola atomicamente il residuo dopo INSERT/UPDATE/DELETE di un pagamento;
- trigger `sync_loan_on_amount_change` che ricalcola il residuo quando cambia il capitale originario e impedisce di ridurlo sotto i pagamenti gia registrati;
- RPC canonica `record_loan_payment_atomic(...)` con lock del prestito e pagamento atomico.

I vincoli sono introdotti `NOT VALID`: non riscrivono o bloccano automaticamente eventuali dati storici gia presenti, ma proteggono le nuove scritture. Prima di validare i constraint in produzione va eseguito un audit dei dati storici.

## Compatibilita con la UI attuale

La UI esistente puo continuare a usare il percorso corrente. Il trigger `AFTER INSERT` aggiorna gia il prestito nella stessa transazione dell'INSERT; l'UPDATE client successivo diventa ridondante ma coerente con lo stesso valore.

Questo consente di ottenere subito atomicita senza cambiare il flusso utente o introdurre una regressione visuale.

## Test aggiunti

Nuovo file:

`tests/integration/supabase-loans.integration.test.ts`

Copre:

- pagamento atomico con residuo corretto;
- sovrapagamento rifiutato senza mutazioni parziali;
- compatibilita del vecchio INSERT diretto;
- ricalcolo su UPDATE/DELETE del pagamento;
- modifica capitale originario;
- blocco capitale inferiore ai pagamenti esistenti;
- isolamento cross-user.

I test usano lo stesso ambiente Supabase integration gia previsto dal repository e vengono saltati quando le variabili `SUPABASE_TEST_*` non sono presenti.

## Limite volutamente non incluso

Questo sprint non crea automaticamente un movimento bancario quando viene registrata una rata di prestito. Per farlo correttamente serve una scelta esplicita del conto e una UX chiara, perche il rimborso di capitale dovrebbe essere trattato come movimento neutro e non come vero reddito/spesa. Tale collegamento e' consigliato come fase successiva, separata dall'invariante contabile introdotta qui.

## Validazione richiesta prima del merge

Prima del merge in `main`:

1. applicare `00040` su Supabase locale con `supabase db reset`;
2. eseguire `npx vitest run tests/integration/supabase-loans.integration.test.ts` con env di integrazione;
3. eseguire `npm run test:run`;
4. verificare Vercel Preview;
5. smoke test manuale Prestiti: pagamento parziale, saldo completo, tentativo di sovrapagamento.

## Stato

- Codice branch: completato.
- Migration: scritta, non ancora applicata in produzione.
- Test integration: aggiunti, da eseguire su Postgres locale.
- Merge su `main`: da non fare finche la migration non e' stata validata su database locale.
