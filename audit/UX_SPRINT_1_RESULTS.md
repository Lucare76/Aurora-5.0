# UX Sprint 1 - Risultati

## Obiettivo

Rendere Aurora 5.0 piu' intuitiva nel primo utilizzo senza modificare logica contabile, database, API, RPC, import/export o report.

## File creati

- `audit/UX_SPRINT_1_PLAN.md`
- `audit/UX_SPRINT_1_RESULTS.md`
- `src/components/onboarding/FirstUseChecklist.tsx`
- `tests/ui/first-use-checklist.test.ts`

## File modificati

- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/layout.tsx`
- `src/app/(app)/transactions/page.tsx`
- `src/app/(app)/categories/page.tsx`
- `src/app/(app)/categories/collapsible-category-list.tsx`
- `src/app/(app)/budgets/page.tsx`
- `src/app/(app)/recurring/page.tsx`
- `src/app/(app)/loans/page.tsx`

## Migliorie introdotte

### Checklist primo utilizzo

Aggiunta una checklist non invasiva in Dashboard quando i passi principali non sono completati:

- crea il primo conto;
- verifica o crea le categorie;
- inserisci il primo movimento;
- esplora la Dashboard;
- crea il primo budget come passaggio facoltativo.

La checklist sparisce automaticamente quando conto, categorie e primo movimento sono presenti.

### Messaggio di benvenuto

La checklist contiene un messaggio leggero:

`Benvenuto in Aurora`

Non e' un popup e non blocca l'uso dell'app.

### Stati vuoti e micro-aiuti

Aggiornati testi e descrizioni per:

- Dashboard senza conti;
- Movimenti senza dati;
- Categorie;
- Budget;
- Ricorrenze;
- Prestiti.

### Linguaggio coerente

Uniformati i termini principali:

- `Movimenti` per la sezione operativa delle registrazioni;
- `Nuovo movimento` per l'azione principale;
- `Trasferimento` per lo spostamento tra conti;
- `Auto-crea movimento` per le ricorrenze.

Le route e i nomi interni non sono stati rinominati.

### Accessibilita'

Il nuovo componente checklist usa label testuali e `aria-label` descrittivi sui passi completati o da completare.

## Test aggiunti

File:

`tests/ui/first-use-checklist.test.ts`

Casi coperti:

- checklist visibile quando il setup iniziale non e' completato;
- passi gia' svolti marcati come completati;
- checklist nascosta quando i passi principali sono completi;
- budget facoltativo non blocca il completamento.

## Verifiche

```text
npm run test:run
```

Esito: verde.

- Test files: 8 passed, 1 skipped.
- Tests: 107 passed, 14 skipped, 121 totali.

```text
npm run test:coverage
```

Esito: verde.

- Statements: 97.6%.
- Branches: 89.37%.
- Functions: 100%.
- Lines: 97.38%.

```text
npm run build
```

Esito: verde.

```text
git diff --check
```

Esito: verde.

## Limiti residui

- La checklist usa segnali gia' disponibili lato UI: presenza di conti attivi, categorie, movimenti recenti e budget.
- Non introduce persistenza dedicata per "ho esplorato la Dashboard"; la Dashboard e' considerata esplorata quando l'utente la visualizza.
- Non modifica i flussi import/export, report o calcoli: gli interventi sono solo di orientamento e microcopy.

## Conferme vincoli

- Database non modificato.
- Dati non modificati.
- Migration non create.
- API non modificate.
- RPC non modificate.
- Logica contabile non modificata.
- `AppTransaction` non modificato.
- Calcoli non modificati.
- Report non modificati nella logica.
- Import/export non modificati nella logica.
- Nessun commit.
- Nessun push.
