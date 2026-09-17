# Aurora 5.0 — Completeness Audit

Data audit: 17 settembre 2026
Branch audit: `audit/completeness-2026-09`
Base: `main`

## Obiettivo

Valutare cosa manca davvero ad Aurora 5.0 per poterla considerare un prodotto personale maturo, affidabile e sostenibile nel tempo, distinguendo fra bug/rischi concreti, limiti intenzionali e semplici miglioramenti di prodotto.

Questo audit è statico su repository GitHub e documentazione tecnica. Non sostituisce browser E2E, test DB live o test manuali su device.

## Stato generale

Aurora non è più una semplice app di contabilità personale. Il repository contiene oggi un sistema ampio con:

- conti, movimenti, categorie e trasferimenti atomici;
- movimenti neutrali;
- riconciliazione bancaria;
- budget, obiettivi, report e salute finanziaria;
- calendario, ricorrenze, automazioni e notifiche;
- Data Integrity Center;
- ricerca globale e command menu;
- scenari finanziari;
- affordability auto/casa/viaggi e confronto decisioni;
- backup completo e restore reale atomico su account vuoto, già testato live;
- assistente finanziario con provider controllato e tracking costi;
- moduli personali aggiuntivi: ADI, Aurora, ferie/permessi, scadenze, timeline familiare;
- dashboard personale;
- test unitari e integrazione contabile.

Il vecchio audit funzionale di luglio 2026 è quindi parzialmente superato: diverse criticità allora indicate sono state risolte da sprint successivi, in particolare backup/restore, ricerca globale, dashboard, notifiche, Data Integrity, scenari, affordability e riconciliazione.

## Verdetto sintetico

Non emergono blocker critici che impediscano l'uso quotidiano dell'app. Il nucleo contabile è molto più maturo rispetto alla prima metà del 2026.

Le aree residue più importanti non sono nuove feature generiche, ma tre problemi di affidabilità/prodotto:

1. prestiti non integrati davvero con la contabilità e aggiornati con scritture client-side non atomiche;
2. onboarding dichiarato nel modello dati ma non trasformato in un vero percorso guidato;
3. assenza di una CI GitHub che renda automatici typecheck/test prima del merge.

Subito dopo vengono E2E browser, osservabilità e razionalizzazione della navigazione.

---

## P1 — Prestiti: il gap funzionale più concreto

### Evidenza attuale

`src/app/(app)/loans/page.tsx` gestisce il pagamento in due operazioni separate dal client:

1. insert in `loan_payments`;
2. update del campo `remaining` sul prestito.

Le due operazioni non sono racchiuse in una singola RPC/transazione DB. Se la prima riesce e la seconda fallisce, lo storico pagamenti e il residuo possono divergere.

Inoltre il pagamento non genera un movimento sul conto. Quindi un prestito può risultare saldato nella sezione Prestiti senza che la stessa operazione abbia modificato saldo conto, cash flow e report.

### Edge case reale

Lo schema client richiede solo `amount > 0`. Non impedisce `payment > remaining`.

Il codice usa:

`Math.max(paymentLoan.remaining - values.amount, 0)`

quindi un pagamento superiore al residuo viene registrato integralmente in `loan_payments`, mentre il prestito viene semplicemente portato a zero. Questo crea uno storico economicamente incoerente.

Anche `Segna saldato` aggiorna direttamente `remaining = 0` senza creare una rata/pagamento di chiusura.

### Intervento proposto

Sprint dedicato `loan-accounting-hardening`:

- RPC atomica `record_loan_payment`;
- validazione `amount <= remaining` salvo esplicita gestione overpayment;
- account obbligatorio/opzionale per la registrazione del pagamento;
- creazione atomica del relativo movimento contabile quando richiesta;
- relazione fra `loan_payment` e `transaction`;
- `settleLoan` trasformato in un'operazione esplicita e tracciata;
- test rollback/errori concorrenti.

Priorità: **alta**.

---

## P1 — Onboarding incompleto

### Evidenza attuale

Il modello `profiles` contiene `onboarding_done` e viene inizializzato a `false`. Il valore è anche incluso in backup/restore e impostazioni.

Non emerge però un flusso applicativo che utilizzi quel flag per guidare realmente l'utente attraverso un onboarding.

### Perché conta

Aurora ha ormai oltre venti aree di navigazione. Per un utente nuovo, esporre subito Conti, Budget, Obiettivi, Report, Salute finanziaria, Data Integrity, Calendario, Automazioni, Ricorrenti, Prestiti, Scenari, Affordability e moduli personali aumenta il carico cognitivo.

### Intervento proposto

Onboarding leggero, non invasivo:

- step 1: crea/verifica primo conto;
- step 2: verifica saldo iniziale;
- step 3: inserisci o importa primo movimento;
- step 4: spiega trasferimenti e movimenti neutrali;
- step 5: prima riconciliazione;
- checklist persistente e dismissibile;
- `onboarding_done = true` quando completato o ignorato esplicitamente.

Priorità: **alta per qualità prodotto**, non blocker tecnico.

---

## P1 — CI GitHub assente

### Evidenza attuale

Il repository non contiene `.github/workflows`.

`package.json` espone script per build, test, coverage e integrazione, ma il controllo automatico corrente dipende soprattutto dal deploy Vercel e dai test eseguiti manualmente durante gli sprint.

### Rischio

Un branch può arrivare al merge senza una policy automatica che esegua sempre almeno:

- TypeScript;
- unit/API tests;
- integration accounting test dove possibile;
- build.

### Intervento proposto

GitHub Actions PR gate:

- install deterministico;
- `npx tsc --noEmit`;
- `npm run test:run`;
- build con env mock sicure oppure route runtime-safe;
- opzionale coverage threshold;
- test DB separato con Supabase locale in job dedicato.

Priorità: **alta per sostenibilità del progetto**.

---

## P2 — Browser E2E ancora mancante

### Evidenza attuale

`package.json` non include Playwright/Cypress né script E2E.

La suite Vitest è ormai ampia, ma non copre realmente flussi browser completi come:

- login → nuovo movimento → saldo aggiornato;
- transfer → modifica → delete;
- movimento neutro;
- riconciliazione 0,00 / 0,01;
- budget;
- notifiche;
- restore UI protetto;
- mobile navigation.

### Intervento proposto

Aggiungere pochi E2E ad altissimo valore, non una suite enorme. 8-12 percorsi core sono sufficienti per iniziare.

Priorità: **media-alta**.

---

## P2 — Osservabilità applicativa

### Evidenza attuale

Non emerge dal repository un sistema strutturato di error monitoring tipo Sentry o equivalente.

Aurora ha ormai cron, notifiche, import, restore, automazioni, AI e numerose API. I toast client non bastano per diagnosticare regressioni in produzione.

### Intervento proposto

- error monitoring server/client;
- request correlation id sulle operazioni sensibili;
- alert su cron `daily-check` fallito;
- metriche minime su restore/import/automation;
- nessun dato finanziario sensibile nei payload di telemetria.

Priorità: **media**.

---

## P2 — Backup restore: molto maturo ma intenzionalmente limitato

Il restore reale è stato testato live con successo, è atomico, rimappa UUID, riconcilia categorie default, verifica ownership e blocca un secondo restore su account non vuoto.

Il limite attuale è intenzionale: `ActiveRestoreMode` supporta solo `empty_account_restore` anche se i tipi contemplano `merge` e `replace_all`.

Non considero questo un bug. Per un'app personale, mantenere il restore limitato al caso più sicuro può essere una scelta corretta.

Eventuale estensione `merge/replace` va fatta solo se emerge un bisogno reale.

Priorità: **bassa / non necessaria ora**.

---

## P2 — Navigazione e information architecture

La navigazione principale include molte aree funzionali. È potente ma sta diventando lunga.

Prima di aggiungere nuove sezioni, conviene valutare raggruppamenti:

- Finanze quotidiane;
- Pianificazione;
- Analisi e controllo;
- Automazioni;
- Area personale/famiglia;
- Impostazioni.

Il command menu e la ricerca globale riducono già il problema, quindi non serve un redesign aggressivo.

Priorità: **media-bassa**.

---

## Aree che NON considero più gap principali

### Backup e restore

Il vecchio audit segnalava l'assenza di restore. È superato: Sprint Backup 5C documenta un restore reale completato e verificato su secondo account, atomico e con remapping UUID.

### Ricerca globale

La vecchia richiesta di ricerca globale è superata: esistono service, API, hook, trigger e command menu dedicati.

### Report e dashboard

Dopo gli sprint report professionali, financial health e personal dashboard, non sono più aree da ricostruire. Restano solo rifiniture.

### Data Integrity

È ormai un modulo proprio e include anche le nuove regole di riconciliazione.

### Scenari e affordability

Sono moduli maturi e separati dai dati reali. Non richiedono nuovi motori prima di completare le priorità sopra.

### Riconciliazione bancaria / movimenti neutrali

Funzionalità implementate, testate su Postgres locale e smoke-testate in produzione il 17/09/2026.

---

## Roadmap raccomandata

### Sprint A — Loan Accounting Hardening

Obiettivo: eliminare il più evidente punto in cui un modulo finanziario può divergere dalla contabilità reale.

Deliverable:

- RPC atomica pagamenti;
- integrazione opzionale/esplicita con movimenti;
- overpayment guard;
- test DB e UI.

### Sprint B — CI + Core E2E

Obiettivo: rendere automatico il livello di sicurezza che oggi viene raggiunto manualmente.

Deliverable:

- GitHub Actions;
- typecheck + Vitest + build;
- primi E2E core;
- branch protection dopo verifica.

### Sprint C — Guided Onboarding

Obiettivo: rendere Aurora autoesplicativa a un utente nuovo senza semplificare il prodotto per chi è già esperto.

### Sprint D — Observability

Obiettivo: sapere subito se cron/API/import/restore/AI falliscono in produzione.

### Sprint E — IA/navigation polish

Solo dopo i quattro sprint precedenti.

---

## Conclusione

Aurora 5.0 è già utilizzabile come sistema personale completo e il core contabile è ormai robusto. Non serve inseguire nuove feature per definirla "completa".

Il salto di qualità successivo viene da affidabilità e riduzione del rischio operativo:

**prestiti atomici e contabili → CI/E2E → onboarding → osservabilità**.

Dopo questi interventi, ulteriori feature dovrebbero essere aggiunte solo sulla base di esigenze d'uso reali, non per colmare una generica sensazione di incompletezza.
