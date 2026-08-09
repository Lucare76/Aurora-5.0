# Sprint 35 - Dashboard personale unificata

## Audit iniziale

Comandi iniziali:

- `git status --short`: working tree pulita.
- `git branch --show-current`: `main`.
- `git log -1 --oneline`: `45de03c feat: add private personal deadlines module`.

File analizzati, entro il limite di 30:

- `src/app/(app)/dashboard/page.tsx`
- `src/app/api/dashboard/route.ts`
- `src/lib/dashboard/service.ts`
- `src/lib/dashboard/types.ts`
- `src/app/api/financial-health/route.ts`
- `src/app/api/data-integrity/route.ts`
- `src/app/api/deadlines/route.ts`
- `src/lib/deadlines/index.ts`
- `src/lib/deadlines/date-only.ts`
- `src/lib/leave/calculations.ts`
- `src/app/api/leave/entries/route.ts`
- `src/lib/budgets/service.ts`
- `src/lib/goals/service.ts`
- `src/lib/data-integrity/service.ts`
- `src/lib/dependent-finance/calculations.ts`
- `src/app/api/aurora/route.ts`
- `src/app/api/adi/route.ts`
- `src/lib/access/private-finance-access.ts`
- `src/components/ui/status-badge.tsx`
- `src/components/ui/card.tsx`
- `tests/api/dashboard-route.test.ts`

Criticita' rilevate:

- La dashboard precedente era una pagina client orientata alla sola panoramica finanziaria.
- Le sezioni private non avevano un centro operativo unificato.
- Mancava una singola API di overview personale.
- La dashboard usava piu' fetch client-side per Financial Health, preferenze e Data Integrity.

## Architettura scelta

Nuovo flusso:

```text
moduli esistenti
  -> helper/service esistenti
  -> src/lib/dashboard/personal-overview.ts
  -> GET /api/dashboard/personal-overview
  -> /dashboard
```

Il nuovo aggregator:

- combina dati gia' derivati;
- produce un view model UI;
- ordina le priorita' solo per presentazione;
- non modifica severity;
- non crea scoring finanziario;
- non duplica business logic contabile.

## File creati

- `src/lib/dashboard/personal-overview.ts`
- `src/app/api/dashboard/personal-overview/route.ts`
- `tests/unit/dashboard/personal-overview.test.ts`
- `tests/api/dashboard-personal-overview-route.test.ts`
- `audit/PERSONAL_DASHBOARD_SPRINT_35_RESULTS.md`

## File modificati

- `src/app/(app)/dashboard/page.tsx`
- `docs/USER_GUIDE.md`
- `docs/PRODUCTION_CHECKLIST.md`

## API

Nuova API:

- `GET /api/dashboard/personal-overview`

Proprieta':

- richiede autenticazione;
- restituisce 401 senza sessione;
- usa `Cache-Control: no-store`;
- sanitizza errori interni;
- esclude server-side dati HR/private finance per utenti non autorizzati.

## Query principali

L'endpoint usa query e servizi in parallelo:

- Financial Health service esistente;
- dashboard service esistente;
- Data Integrity: issue open limit 5 + latest scan;
- notifiche importanti non lette limit 5;
- scadenze personali solo HR autorizzato, range mese corrente;
- ferie/permessi solo HR autorizzato, range anno corrente;
- Aurora/ADI solo private finance autorizzato.

## Sezioni

### Cosa richiede attenzione

Massimo 5 item, ordinati per priorita' presentazionale:

1. Data Integrity CRITICAL
2. scadenze scadute
3. scadenze oggi
4. budget superato
5. scadenze imminenti/notifiche/permessi

### Oggi

Mostra scadenze scadute, scadenze oggi, reminder attivi, ferie/permessi in corso e notifiche importanti.

Empty state:

- "Nulla richiede attenzione oggi."

### Questa settimana

Mostra scadenze, ferie e permessi entro i prossimi 7 giorni.

### Questo mese

Mostra:

- scadenze scadute/oggi/7 giorni/completate;
- ferie usate/residue;
- permessi 104 usati/residui;
- budget regolari/warning/superati;
- obiettivi attivi.

### Panoramica finanziaria

Riutilizza dashboard service e Financial Health.

Mostra:

- patrimonio personale;
- entrate mese;
- uscite mese;
- saldo netto;
- score/stato Financial Health.

## Scope e sezioni private

- Aurora e ADI non vengono inclusi nel patrimonio personale.
- Aurora e ADI appaiono solo come card private separate.
- Ferie/104 e Scadenze sono escluse server-side per utenti non autorizzati.
- Non vengono inviati dati privati al client quando l'utente non e' autorizzato.

## Partial failure

Strategia:

- se una sezione non fondamentale fallisce, il payload resta disponibile e la sezione viene marcata `UNAVAILABLE`;
- se falliscono entrambe le fonti finanziarie fondamentali, l'API restituisce errore.

## Performance

- Query indipendenti in `Promise.all`.
- Limiti espliciti per notifiche, Data Integrity e scadenze.
- Nessun caricamento completo della cronologia Data Integrity.
- Nessun polling aggressivo: solo refresh manuale.

## Responsive e accessibilita'

La UI usa:

- layout a colonna su mobile;
- card full width;
- CTA testuali;
- `aria-live` per ultimo aggiornamento;
- heading hierarchy coerente;
- status testuali tramite `StatusBadge`, non solo colore.

## Test aggiunti

Unit:

- empty state;
- deadline scaduta;
- deadline oggi;
- deadline settimana;
- Data Integrity CRITICAL/WARNING;
- permessi quasi esauriti;
- ferie residue;
- budget warning;
- ordinamento priorita';
- limite massimo 5 alert;
- sezioni private escluse;
- Aurora separata dal patrimonio personale;
- ADI separata;
- partial unavailable;
- date boundary date-only.

API:

- 401 senza autenticazione;
- payload base;
- header no-store;
- errore sanitizzato.

## Verifiche

Eseguite a fine sprint:

- `npx tsc --noEmit`: PASS.
- `npx vitest run tests/unit/dashboard/personal-overview.test.ts tests/unit/dashboard/personal-overview-loader.test.ts tests/api/dashboard-personal-overview-route.test.ts tests/api/dashboard-route.test.ts`: PASS, 4 file, 26 test.
- `npx vitest run`: PASS, 125 file passati, 1 skipped, 1588 test passati, 14 skipped.
- `npm run test:coverage`: PASS, 125 file passati, 1 skipped, 1588 test passati, 14 skipped.
- `npm run build`: PASS.

Coverage globale:

- Statements: 85.07%
- Branches: 76.95%
- Functions: 88.14%
- Lines: 87.41%

Coverage `src/lib/dashboard/personal-overview.ts`:

- Statements: 94.77%
- Branches: 78.04%
- Functions: 97.61%
- Lines: 99.14%

Nota coverage:

- Il target Sprint 35 per il nuovo modulo era 95/90/95/95.
- Functions e Lines superano il target.
- Statements resta appena sotto target (-0,23 punti).
- Branches resta sotto target per combinazioni difensive/opzionali del view model e partial failure non tutte materialmente utili da testare senza creare test artificiali.
- Non sono state abbassate soglie globali.

## Rischi residui

- La verifica responsive completa resta manuale su browser reale.
- Il target branch coverage del singolo file non e' stato raggiunto senza aggiungere test artificiali.
- Nessuna nuova persistenza e nessuna nuova migration sono state introdotte.

## Smoke test manuale preparato

Checklist:

1. `/dashboard` si apre.
2. Nessun hydration error.
3. "Cosa richiede attenzione" mostra dati coerenti.
4. Una scadenza scaduta appare tra le priorita'.
5. Una scadenza futura appare in settimana/mese corretti.
6. Ferie/104 visibili solo account autorizzato.
7. Aurora visibile solo account autorizzato.
8. ADI visibile solo account autorizzato.
9. Patrimonio personale invariato.
10. Movimenti Aurora non aggregati nel personale.
11. Refresh funziona.
12. Mobile 390px senza overflow.

## Conferme

- Nessuna business logic finanziaria duplicata.
- Nessun movimento Aurora incluso nel personale.
- Nessun patrimonio Aurora incluso nel personale.
- Nessun ADI incluso nel personale.
- Nessun dato HR inviato a utenti non autorizzati.
- Nessuna AI modificata.
- Nessuna migration remota.
- Nessun dato reale modificato.
- Nessun commit.
- Nessun push.
- Nessun deploy.
