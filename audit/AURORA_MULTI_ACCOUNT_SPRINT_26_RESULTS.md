# Sprint 26 - Patrimonio Aurora Multi-Conto

## Analisi iniziale

Lo Sprint 25A aveva gia introdotto pagina `/aurora`, API Aurora, helper di perimetro e isolamento dai calcoli personali. Il gap principale rispetto allo Sprint 26 era operativo:

- il valore salvato per i conti Aurora doveva tornare coerente con `DEPENDENT`;
- il conto esistente "Aurora piano di accumulo" doveva diventare automaticamente il primo conto Aurora;
- i movimenti Aurora dovevano essere modificabili ed eliminabili dalla pagina dedicata.

## Schema scelto

Non e stato introdotto un nuovo motore contabile.

Aurora usa:

- `accounts` per i conti;
- `transactions` per entrate, uscite e transfer;
- RPC atomiche esistenti per creazione, modifica ed eliminazione;
- `account_purpose_links` per classificare i conti come `DEPENDENT`.

`DEPENDENT_AURORA` resta supportato come alias applicativo legacy, ma il valore scritto da Aurora e `DEPENDENT`.

## API

`/api/aurora` supporta:

- `linkAccount`
- `createAccount`
- `updateAccount`
- `createTransaction`
- `updateTransaction`
- `deleteTransaction`
- `createTransfer`

Ogni azione verifica autenticazione, ownership e perimetro lato server.

## UI

La pagina `/aurora` contiene:

- riepilogo;
- conti;
- nuovo conto Aurora;
- nuovo movimento Aurora;
- giroconti Aurora/personale;
- statistiche;
- ultimi movimenti con modifica/eliminazione.

## Isolamento

Dashboard, report, Financial Health e affordability continuano a usare i filtri centralizzati che escludono i conti `DEPENDENT`/Aurora dal patrimonio personale.

## Test

Sono stati aggiornati i test per:

- contratto API Aurora;
- uso delle RPC atomiche create/update/delete;
- perimetri e filtri multi-conto;
- migration locale coerente con `DEPENDENT`;
- assenza di duplicazioni di motore contabile.

## Rischi residui

- Il restore completo dei metadati Aurora/ADI resta fuori perimetro.
- La modifica dei giroconti Aurora e limitata: la creazione/eliminazione usa il motore transfer esistente, mentre l'editing diretto dei transfer complessi resta demandato a flussi dedicati.
- La migration non e stata applicata in remoto durante lo sprint.
