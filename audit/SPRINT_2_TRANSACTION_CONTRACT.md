# Sprint 2 - Contratto applicativo transazioni

## Decisione applicativa

Da Sprint 2, `transfer_peer_id` non deve essere interpretato direttamente dal nuovo codice.

Il campo DB resta invariato, ma a livello applicativo viene classificato tramite:

- `src/domain/accounting/transfer-model.ts`
- `src/domain/accounting/transaction-adapter.ts`

La classificazione esplicita e':

- `none`: nessun riferimento.
- `peer_transaction`: modello storico con transazione gemella valida e reciproca.
- `destination_account`: modello corrente RPC con conto destinazione.
- `ambiguous`: lo stesso UUID coincide con una transazione e con un conto.
- `orphan`: il riferimento non e' stato trovato.
- `invalid`: il riferimento esiste ma viola una regola di coerenza.

## Contratto transfer adottato

### Modello storico supportato

Un transfer storico puo' essere rappresentato da due transazioni collegate:

- transazione sorgente;
- transazione peer;
- `transfer_peer_id` punta alla transazione peer;
- la peer deve puntare indietro alla transazione sorgente;
- importo uguale;
- utente uguale;
- conti diversi.

Classificazione: `peer_transaction`.

### Modello corrente supportato

Un transfer corrente e' rappresentato da una singola transazione:

- `type = transfer`;
- `account_id` = conto sorgente;
- `transfer_peer_id` = conto destinazione;
- conto sorgente e destinazione diversi;
- stesso utente.

Classificazione: `destination_account`.

## Adapter

L'adapter espone un modello applicativo:

```ts
{
  sourceAccountId: string
  destinationAccountId: string | null
  peerTransactionId: string | null
  transferReferenceKind:
    | 'none'
    | 'peer_transaction'
    | 'destination_account'
    | 'ambiguous'
    | 'orphan'
    | 'invalid'
}
```

Responsabilita':

- trasformare una riga `transactions` DB nel modello applicativo;
- mantenere `transfer_peer_id` compatibile con lo schema corrente;
- impedire al nuovo codice di dedurne il significato senza classificazione.

Integrazione Sprint 2:

- `useTransactions` espone ora anche `adaptedTransactions`.
- `transactions` e i totali esistenti restano invariati.
- Nessuna pagina e' stata rifattorizzata massivamente.

## Contratto API POST definitivo Sprint 2

Endpoint: `POST /api/transactions`

### Income

Accetta:

```ts
{
  type: 'income'
  account_id: uuid
  amount: number > 0 finite
  description: string non vuota
  date: YYYY-MM-DD reale
  category_id?: uuid | null
  notes?: string | null
  recurring_id?: uuid | null
}
```

Non accetta:

- `destination_account_id`
- `user_id`
- campi extra

### Expense

Accetta:

```ts
{
  type: 'expense'
  account_id: uuid
  amount: number > 0 finite
  description: string non vuota
  date: YYYY-MM-DD reale
  category_id?: uuid | null
  notes?: string | null
  recurring_id?: uuid | null
}
```

Non accetta:

- `destination_account_id`
- `user_id`
- campi extra

### Transfer

Accetta:

```ts
{
  type: 'transfer'
  account_id: uuid
  destination_account_id: uuid
  amount: number > 0 finite
  description: string non vuota
  date: YYYY-MM-DD reale
  notes?: string | null
  recurring_id?: uuid | null
}
```

Regole:

- `destination_account_id` obbligatorio.
- `destination_account_id !== account_id`.
- `category_id` non ammesso.
- `user_id` non ammesso.
- campi extra non ammessi.

### Risposta successo POST

Status: `201`

Body:

```json
{ "data": "<rpc result>" }
```

## Contratto API PATCH Sprint 2

PATCH resta parziale per compatibilita' con il client attuale.

Accetta:

```ts
{
  transaction_id: uuid
  account_id?: uuid
  type?: 'income' | 'expense' | 'transfer'
  amount?: number > 0 finite
  date?: YYYY-MM-DD reale
  description?: string non vuota
  category_id?: uuid | null
  notes?: string | null
  destination_account_id?: uuid | null
  clear_category?: boolean
}
```

Regole:

- campi extra non ammessi;
- se `account_id` e `destination_account_id` sono entrambi presenti devono essere diversi.

Nota: PATCH non e' stato trasformato in comando completo per evitare rotture UI e RPC in questo sprint.

## Contratto API DELETE Sprint 2

DELETE usa un solo contratto:

```ts
{
  transaction_id: uuid
}
```

L'ID resta nel JSON body per compatibilita' con il client corrente.

Query parameter non supportato.

Body mancante o JSON invalido restituisce `400`, non piu' `500` generico.

## Errori API

### Validazione

Status: `400`

Body:

```json
{
  "error": "Dati non validi",
  "code": "VALIDATION_ERROR",
  "details": {}
}
```

### Non autenticato

Status: `401`

Body:

```json
{ "error": "Non autenticato" }
```

### Ownership/not found RPC

Status: `403`

Body con messaggio sicuro dalla allowlist.

### Constraint RPC

Status: `409`

Body sanificato se il messaggio non e' in allowlist.

### Errore interno/RPC sconosciuta

Status: `500`

Body sanificato. I messaggi raw non vengono piu' restituiti al client.

## Compatibilita'

Compatibile:

- UI corrente che invia POST/PATCH/DELETE JSON.
- RPC esistenti.
- Schema DB corrente.
- Dati storici.
- Totali dashboard/report.

Potenzialmente non compatibile:

- Client esterni che inviavano `destination_account_id` su income/expense.
- Client esterni che inviavano `category_id` su transfer.
- Client esterni che inviavano campi extra.
- Client esterni che omettevano `destination_account_id` sui transfer aspettandosi errore RPC.

Queste rotture sono considerate desiderabili a livello di contratto perche' impediscono payload ambigui.
