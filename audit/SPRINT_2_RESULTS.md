# Sprint 2 - Risultati

## Esito sintetico

Sprint 2 completato.

Il contratto applicativo delle transazioni e dei giroconti e' stato stabilizzato senza modificare database, migration, RPC o dati reali.

## File creati

- `audit/SPRINT_2_CURRENT_TRANSACTION_CONTRACT.md`
- `audit/SPRINT_2_DEPENDENCY_AUDIT.md`
- `audit/SPRINT_2_TRANSACTION_CONTRACT.md`
- `audit/SPRINT_2_RESULTS.md`
- `src/domain/accounting/transfer-model.ts`
- `src/domain/accounting/transfer-model.test.ts`
- `src/domain/accounting/transaction-adapter.ts`
- `src/domain/accounting/transaction-adapter.test.ts`

## File modificati

- `src/app/api/transactions/route.ts`
- `src/hooks/use-transactions.ts`

File gia' modificati dallo Sprint 1 e ancora non committati:

- `package.json`
- `package-lock.json`
- `vitest.config.ts`
- `src/domain/accounting/calculations.ts`
- `src/domain/accounting/calculations.test.ts`
- `tests/fixtures/accounting-fixture.ts`
- `tests/api/transactions-route.test.ts`

## Test

Test totali: 50.

Risultato:

- Test files: 4 passed.
- Tests: 50 passed.
- Failed: 0.

Incremento rispetto a Sprint 1:

- Sprint 1: 24 test.
- Sprint 2: 50 test.
- Nuovi test: 26.

## Coverage

Comando:

```bash
npm run test:coverage
```

Risultato:

- Statements: 88.5%.
- Branches: 73.86%.
- Functions: 82.6%.
- Lines: 89.28%.

## Build

Comando:

```bash
npm run build
```

Risultato: superato.

Dettagli:

- Next.js compiled successfully.
- TypeScript completato senza errori.
- Static pages generate: 19/19.

## Dependency audit

Comando:

```bash
npm audit --json
```

Risultato:

- 3 vulnerabilita totali.
- 2 moderate.
- 1 high.

Sintesi:

| Pacchetto | Severita | Tipo | Raccomandazione |
|---|---|---|---|
| `postcss` | moderate | transitiva via `next` | aggiornare in sprint separato |
| `next` | moderate | diretta, via `postcss` | accettare temporaneamente, non fare downgrade |
| `xlsx` | high | diretta | priorita alta in sprint separato |

Nessun fix automatico eseguito.

## Contratto transfer adottato

Il campo DB `transfer_peer_id` resta invariato ma non e' piu' considerato semanticamente autosufficiente nel nuovo codice.

Il nuovo contratto applicativo classifica ogni riferimento come:

- `none`
- `peer_transaction`
- `destination_account`
- `ambiguous`
- `orphan`
- `invalid`

Il modello storico a due transazioni e il modello corrente a singola transazione sono entrambi supportati e distinguibili.

## Contratto API stabilizzato

POST ora usa schema discriminato per tipo:

- income/expense non accettano `destination_account_id`;
- transfer richiede `destination_account_id`;
- transfer non accetta `category_id`;
- source e destination devono essere diversi;
- campi extra sono respinti;
- `user_id` e' respinto;
- data, importo e descrizione sono validati in modo piu' stretto.

PATCH resta parziale per compatibilita'.

DELETE resta con JSON body `{ transaction_id }`, ma body mancante o non valido produce `400` coerente.

## Incoerenze ancora aperte

1. `transfer_peer_id` resta fisicamente un campo ambiguo nello schema DB.
   - Risoluzione definitiva: migration o nuovo campo canonico in Sprint futuro.

2. Dashboard/report continuano a leggere direttamente `transfer_peer_id`.
   - Non modificato per evitare cambiamento dei totali contabili.
   - Proposta: Sprint 3 centralizzare calcoli e usare adapter.

3. Pagina transazioni interpreta ancora direttamente `transfer_peer_id` in vari punti.
   - Non rifattorizzata massivamente per rispettare lo scope.
   - Proposta: migrazione progressiva verso `AppTransaction`.

4. PATCH resta semanticamente parziale e non command-based.
   - Scelta di compatibilita'.
   - Proposta: Sprint futuro con endpoint command-based per transfer edit.

5. Le RPC continuano a usare `transfer_peer_id` come destination account id.
   - Non modificato per vincolo Sprint 2.

## Cosa non e' stato modificato

- Nessun dato Supabase reale.
- Nessuna migration.
- Nessuno schema database.
- Nessuna RPC.
- Nessuna conversione record storici.
- Nessuna cancellazione o modifica transazioni.
- Nessun totale dashboard/report.
- Nessun fix automatico dipendenze.
- Nessun commit.
- Nessun push.

## Proposta Sprint 3

Sprint 3 dovrebbe concentrarsi su una sola fonte di verita' contabile:

1. Centralizzare i calcoli dashboard/report in dominio o service layer.
2. Adottare `AppTransaction` progressivamente in dashboard, report e pagina transazioni.
3. Definire una migration futura per separare:
   - `transfer_peer_transaction_id`;
   - `destination_account_id`.
4. Aggiungere test di integrazione su Supabase locale/ephemeral per RPC reali.
5. Decidere se PATCH deve restare parziale o diventare command-based.
