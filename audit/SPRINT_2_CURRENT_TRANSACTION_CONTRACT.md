# Sprint 2 - Contratto transazioni attuale

## Ambito

Questo documento fotografa il contratto attuale di `src/app/api/transactions/route.ts` prima della normalizzazione Sprint 2.

Non descrive un contratto ideale: descrive il comportamento reale osservato nel codice, nei tipi e nelle migration.

## API attuale

Endpoint: `/api/transactions`

Metodi implementati:

- `POST`
- `PATCH`
- `DELETE`

L'API usa `createClient()` server-side e legge l'utente da `supabase.auth.getUser()`. Non accetta `user_id` dal client.

## POST attuale

### Payload

Schema Zod attuale:

```ts
{
  description: string.min(1),
  amount: number.positive(),
  date: string regex YYYY-MM-DD,
  type: 'income' | 'expense' | 'transfer',
  account_id: uuid,
  destination_account_id?: uuid,
  category_id?: uuid | null,
  notes?: string | null,
  recurring_id?: uuid | null
}
```

### Campi obbligatori

- `description`
- `amount`
- `date`
- `type`
- `account_id`

### Campi opzionali

- `destination_account_id`
- `category_id`
- `notes`
- `recurring_id`

### Risposta successo

Status: `201`

Body:

```json
{ "data": "<rpc result>" }
```

### Risposta errore

- `401`: `{ "error": "Non autenticato" }`
- `400`: `{ "error": "Dati non validi", "details": ... }`
- `403`: per messaggi RPC che contengono `not found` o `not owned`
- `500`: altri errori RPC o catch generico

## PATCH attuale

### Payload

Schema Zod attuale:

```ts
{
  transaction_id: uuid,
  account_id?: uuid,
  type?: 'income' | 'expense' | 'transfer',
  amount?: number.positive(),
  date?: string regex YYYY-MM-DD,
  description?: string,
  category_id?: uuid | null,
  notes?: string | null,
  destination_account_id?: uuid | null,
  clear_category?: boolean
}
```

### Semantica

PATCH e' parziale. I campi assenti vengono passati alla RPC come `null` o default.

### Risposta successo

Status: `200`

Body:

```json
{ "data": "<rpc result>" }
```

## DELETE attuale

### Payload

Schema Zod attuale:

```ts
{
  transaction_id: uuid
}
```

### Modalita ID

L'ID e' passato solo tramite JSON body. Query parameter non supportato.

### Risposta successo

Status: `200`

Body:

```json
{ "success": true }
```

## Comportamento income attuale

- Richiede `account_id`, `amount`, `description`, `date`, `type`.
- Accetta `category_id`.
- Accetta anche `destination_account_id` a livello schema, anche se la RPC lo ignora per non-transfer.
- La RPC incrementa il saldo del conto sorgente.
- `transfer_peer_id` viene salvato a `null` dalla RPC.

## Comportamento expense attuale

- Richiede `account_id`, `amount`, `description`, `date`, `type`.
- Accetta `category_id`.
- Accetta anche `destination_account_id` a livello schema, anche se la RPC lo ignora per non-transfer.
- La RPC decrementa il saldo del conto sorgente.
- `transfer_peer_id` viene salvato a `null` dalla RPC.

## Comportamento transfer attuale

- A livello API `destination_account_id` e' opzionale.
- Se `destination_account_id` e' omesso, la request passa lo schema e la RPC riceve `null`.
- Se `destination_account_id` e' `null`, la request fallisce a livello Zod perche' il campo e' opzionale ma non nullable.
- La RPC richiede `p_destination_account_id`, verifica che sia diverso dal conto sorgente e che appartenga all'utente.
- La RPC salva `p_destination_account_id` dentro `transactions.transfer_peer_id`.
- La RPC azzera la categoria sui transfer.

## Significato di `transfer_peer_id`

### Storico

Nel modello iniziale, `transfer_peer_id` era una FK verso `transactions(id)`. I record storici possono quindi contenere l'ID della transazione gemella.

### Corrente RPC

Le RPC attuali usano `transfer_peer_id` come ID del conto destinazione.

### Stato schema

La migration `00009_fix_transfer_peer_id_fkey.sql` rimuove la FK e documenta il campo come UUID libero con doppia semantica.

## Differenze tra API, tipi, RPC e UI

| Area | Comportamento attuale | Rischio |
|---|---|---|
| API POST | `destination_account_id` opzionale per tutti i tipi | Transfer senza destinazione arriva alla RPC invece di fallire prima |
| API POST | `destination_account_id: null` e' rifiutato, campo omesso e' accettato | Incoerenza payload |
| API POST | income/expense accettano `destination_account_id` | Contratto ambiguo |
| API POST | transfer accetta `category_id` | La RPC lo ignora, ma il contratto non lo dichiara |
| API PATCH | parziale, ma `null` e assenza hanno significati misti | Difficile distinguere "non cambiare" da "svuota" |
| API DELETE | body JSON obbligatorio | Una DELETE senza body valido puo' produrre 500 generico |
| Tipi TS | `TransactionType` include `transfer` | Storico puo' rappresentare giroconti con income/expense collegate |
| RPC | usa `transfer_peer_id` come conto destinazione | Diverge dal nome e dal modello storico |
| UI transazioni | interpreta `transfer_peer_id` sia come peer transaction sia come destination account | Ambiguita visiva e di edit |
| Report/dashboard | escludono ogni record con `transfer_peer_id` dai totali | Mantiene i totali correnti ma nasconde la differenza modello vecchio/nuovo |

## Incoerenze dettagliate

### 1. `destination_account_id` opzionale per transfer

- File: `src/app/api/transactions/route.ts`
- Attuale: `destination_account_id` e' opzionale nello schema POST.
- Atteso: obbligatorio per `type = transfer`.
- Rischio: errore spostato dalla validazione API alla RPC; status 500 invece di 400.
- Risolvibile senza migration: si.

### 2. `destination_account_id` accettato su income/expense

- File: `src/app/api/transactions/route.ts`
- Attuale: income/expense possono includere `destination_account_id`.
- Atteso: campo non ammesso per income/expense.
- Rischio: client e test possono credere che abbia effetto.
- Risolvibile senza migration: si.

### 3. `category_id` accettato su transfer

- File: `src/app/api/transactions/route.ts`
- Attuale: transfer puo' includere `category_id`.
- Atteso: transfer senza categoria.
- Rischio: differenza tra payload accettato e dato salvato.
- Risolvibile senza migration: si.

### 4. DELETE fragile senza JSON body

- File: `src/app/api/transactions/route.ts`
- Attuale: `request.json()` e' nel `try`; body mancante genera catch 500.
- Atteso: errore 400 coerente.
- Rischio: debugging difficile e risposta non semantica.
- Risolvibile senza migration: si.

### 5. `transfer_peer_id` ambiguo

- File: `src/types/database.ts`, `src/app/(app)/transactions/page.tsx`, migration `00001`, `00002`, `00003`, `00009`
- Attuale: stesso campo puo' indicare peer transaction o destination account.
- Atteso: modello applicativo esplicito che classifica la semantica prima dell'uso.
- Rischio: update/delete/report possono interpretare UUID storici come conti o viceversa.
- Risolvibile senza migration: parzialmente, tramite adapter; risoluzione definitiva richiede migrazione/modello nuovo.

### 6. Errori RPC potenzialmente troppo esposti in development

- File: `src/app/api/transactions/route.ts`
- Attuale: in development `sanitizeError` restituisce il messaggio raw.
- Atteso: contratto di errore coerente e messaggi raw mai esposti al client.
- Rischio: leakage in ambienti configurati male.
- Risolvibile senza migration: si.
