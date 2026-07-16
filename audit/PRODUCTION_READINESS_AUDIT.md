# Aurora 5.0 - Production Readiness Audit

Data: 2026-07-15  
Ambito: readiness tecnica, stabilita a lungo termine, sicurezza, performance, UX, qualita codice, manutenibilita, scalabilita.  
Vincoli rispettati: nessuna modifica a codice applicativo, database, migration, dati, commit o push.

## Executive Summary

Aurora 5.0 e gia una applicazione personale finanziaria ampia: autenticazione, conti, transazioni, dashboard, report, budget, ricorrenti, prestiti, compleanni, import/export e notifiche. La base e promettente: Next.js, TypeScript, Supabase, RLS, RPC atomiche, validazione Zod, UI coerente.

Non e pero ancora pronta, nello stato attuale, per essere considerata una app stabile da usare senza preoccupazioni per 10 anni. Il motivo non e la mancanza di feature, ma la maturita architetturale: troppa logica critica vive dentro pagine client molto grandi, mancano test, manca una service layer centrale, il modello contabile ha debiti storici, i report non sono ancora una fonte unica di verita, e il database non applica abbastanza invarianti con constraint.

Giudizio sintetico: buona base di prodotto, non ancora prodotto long-term-grade.

## Voti Sintetici

| Area | Voto | Lettura |
|---|---:|---|
| Progetto generale | 6.3/10 | Ricco e usabile, ma ancora fragile come sistema di lungo periodo |
| Architettura | 6/10 | Struttura comprensibile, ma responsabilita troppo concentrate nelle pagine |
| Database | 6/10 | RLS e tabelle complete, ma constraint e modello contabile da consolidare |
| Sicurezza | B- | Buona base Supabase/RLS, ma hardening incompleto |
| Performance | 5.5/10 | Ok per uso piccolo, debole su storico grande e dashboard/report |
| UX | 7/10 | Ampia e piacevole, ma alcuni flussi sono complessi e poco guidati |
| Qualita codice | 5.5/10 | Funziona, ma componenti enormi, duplicazioni e `any` nei punti complessi |
| Manutenibilita | 5/10 | Un nuovo dev capirebbe le basi in giorni, i dettagli critici in settimane |
| Scalabilita | 5.5/10 | Sufficiente per uso personale medio, non ancora per 100k+ movimenti senza refactor |
| Test | 2/10 | Praticamente assenti |

## Parte 1 - Architettura

### Struttura del progetto

La struttura e lineare:

- `src/app`: App Router Next.js.
- `src/app/(app)`: area autenticata.
- `src/app/(auth)`: login e registrazione.
- `src/app/api`: API server.
- `src/hooks`: hook Supabase base.
- `src/components`: UI condivisa.
- `src/lib`: utility, Supabase clients, categorizzazione.
- `src/types`: tipi database.
- `supabase/migrations`: schema e funzioni SQL.
- `audit`: documentazione diagnostica.

Questa organizzazione e buona per un progetto piccolo/medio. Il problema e che la logica di dominio non ha un livello dedicato. Molto codice di business vive direttamente nei componenti `page.tsx`.

### Dimensione dei componenti principali

Le pagine piu importanti sono molto grandi:

| File | Linee circa | Rischio |
|---|---:|---|
| `transactions/page.tsx` | 1099 | Alto |
| `dashboard/page.tsx` | 954 | Alto |
| `import-estratti/page.tsx` | 792 | Alto |
| `reports/page.tsx` | 786 | Alto |
| `accounts/page.tsx` | 573 | Medio/Alto |

Quando una pagina supera 500-700 linee e contiene parsing, query, validazione, form, rendering, aggregazioni e stato UI, diventa difficile da testare e modificare in sicurezza.

### Separazione responsabilita

Punti positivi:

- UI atomiche riutilizzabili (`Button`, `Card`, `Dialog`, `Input`, ecc.).
- Hook base per conti, categorie, transazioni.
- API server per transazioni atomiche.
- Utility comuni per formato valuta/data.

Punti deboli:

- Manca una service layer tipo `services/transactions`, `services/reports`, `services/import`.
- Manca una cartella `features/` con componenti separati per dominio.
- Manca un repository/data access layer centralizzato.
- Report, dashboard, budget e transazioni duplicano logiche di filtro date e trasferimenti.
- Importatori e parser sono dentro pagine React.
- Le query Supabase sono sparse nei componenti.

### Naming

Il naming e generalmente comprensibile. Alcune criticita:

- `transfer_peer_id` oggi e semanticamente ambiguo.
- `useTransactions` sembra generico ma incorpora gia criteri contabili.
- Alcune label/nomi conto sono usati come regole logiche nell'import (`Bancoposta`, `Carta di Credito`), creando dipendenza fragile dal testo.

### Tipizzazione

Punti positivi:

- `src/types/database.ts` contiene tipi ampi.
- Zod e usato in molti form/API.
- Le enum TypeScript aiutano (`TransactionType`, `AccountType`, ecc.).

Punti deboli:

- Diversi `any` nei tooltip Recharts e in punti UI complessi.
- I tipi database sembrano mantenuti manualmente, non generati automaticamente da Supabase.
- Il DB usa colonne `text` per tipi che TypeScript modella come union, senza `CHECK` SQL.

### Duplicazioni

Duplicazioni principali:

- Calcolo intervalli mese.
- Filtri `transfer_peer_id`.
- Export CSV.
- Select field locali duplicati.
- Form dialog CRUD simili.
- Query Supabase client-side ripetute.
- Toast/error handling ripetuto.

### Voto architettura

6/10.

Motivazione: fondamenta ordinate, ma assenza di layer di dominio e componenti troppo grandi rendono rischiosa l'evoluzione a lungo termine.

## Parte 2 - Database

### Schema

Tabelle principali:

- `profiles`
- `accounts`
- `categories`
- `transactions`
- `recurring_rules`
- `budgets`
- `loans`
- `loan_payments`
- `birthdays`
- `audit_logs`
- `birthday_reminder_log`

Lo schema copre bene il dominio attuale.

### Normalizzazione

Buona separazione base tra conti, categorie, transazioni, budget, ricorrenti, prestiti. Criticita:

- `accounts.balance` e saldo derivabile ma memorizzato. E una scelta legittima per performance, ma richiede invarianti forti e test.
- Manca `initial_balance` o una tabella di apertura conto.
- `transfer_peer_id` ha semantica non normalizzata.
- `receipt_data` JSONB e flessibile ma non ancora governato.
- Prestiti non sono integrati con transazioni contabili.

### Indici

Presenti indici base:

- `idx_accounts_user`
- `idx_categories_user`
- `idx_transactions_user`
- `idx_transactions_account`
- `idx_transactions_date`
- altri indici su ricorrenti, budgets, loans, birthdays, audit.

Miglioramenti suggeriti:

- indice composito `transactions(user_id, date desc)`;
- indice `transactions(user_id, account_id, date desc)`;
- indice `transactions(user_id, category_id, date desc)`;
- indice `transactions(user_id, type, date desc)`;
- indice per report mensili o materialized view se lo storico cresce.

### Foreign key

Buone FK di base. Criticita:

- `transactions.transfer_peer_id` non ha piu FK.
- `recurring_id` nella tabella `transactions` non ha FK esplicita verso `recurring_rules`.
- I tipi testuali non hanno constraint.
- Parent category ha FK verso `categories`, ma non garantisce stesso `user_id`.

### Constraint

Mancano constraint importanti:

- `transactions.type IN ('income','expense','transfer')`;
- `transactions.amount > 0`;
- `accounts.type IN (...)`;
- `categories.type IN (...)`;
- `budgets.month BETWEEN 1 AND 12`;
- `currency` ISO 3 lettere;
- coerenza categoria/transazione;
- coerenza parent category/user.

### RLS

RLS presente sulle tabelle principali. Buon punto. Le policy sono semplici e leggibili. Tuttavia RLS non sostituisce i constraint di dominio.

### RPC

Punti forti:

- `create_transaction_atomic`
- `update_transaction_atomic`
- `delete_transaction_atomic`
- uso di `auth.uid()`;
- ownership check;
- `SECURITY DEFINER`;
- audit log.

Punti deboli:

- funzione recurring separata non riusa la stessa logica atomica principale.
- `delete_transaction_atomic` merita verifica grant dopo migration successive.
- modello transfer storico non consolidato.

### Performance DB

Per uso personale leggero va bene. Per 100k+ transazioni servono:

- query aggregate server-side;
- indici compositi;
- viste/materialized views mensili;
- paginazione reale;
- evitare `select('*')` in dashboard/report;
- ridurre query parallele duplicate.

### Voto database

6/10.

Motivazione: schema ampio e RLS buono, ma mancano vincoli forti e il modello transfer/saldi iniziali non e ancora maturo.

## Parte 3 - Sicurezza

### Auth

Supabase Auth e integrato correttamente:

- `AuthContext`;
- proxy server-side;
- redirect login/register;
- profilo creato automaticamente.

Rischi:

- error handling profilo a volte silenzioso;
- nessuna MFA o session management avanzato;
- cancellazione account non elimina `auth.users`.

### API

API transazioni buona: non accetta `user_id`, usa Supabase server client e RPC. API accounts e minimale e meno completa rispetto al resto.

Endpoint notifiche:

- usa service role;
- protetto da `CRON_SECRET`;
- invia email con Resend.

Da verificare in produzione:

- secret impostati;
- logging errori non troppo verboso;
- rate limiting;
- audit accessi cron.

### Supabase e RLS

Buona base: RLS attiva. Rischi:

- troppe scritture dirette client-side su tabelle applicative;
- invarianti affidate al client;
- service role in endpoint server da proteggere con attenzione.

### XSS

Non risultano `dangerouslySetInnerHTML`. React protegge output testuale. Le email HTML usano escaping in daily-check per campi dinamici, buon segnale.

### CSRF

Le API usano cookie/sessione Supabase. Per API mutative sarebbe preferibile aggiungere:

- controllo origin/referer;
- CSRF token o stesso-site policy verificata;
- rate limit.

### SQL Injection

Uso di client Supabase e RPC parametrizzate. Rischio basso.

### Variabili ambiente e secret

Variabili rilevate:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `CRON_SECRET`

Rischi:

- `NEXT_PUBLIC_*` corretti per client.
- service role confinato in `admin.ts` e API server; bene.
- nessuna validazione centralizzata env all'avvio.

### Privacy/GDPR

Mancano elementi da app matura:

- privacy policy;
- export dati completo si, ma non formalizzato come GDPR;
- cancellazione Auth incompleta;
- retention log;
- gestione consenso email;
- data processing notes.

### Livello sicurezza

B-.

Motivazione: RLS, Supabase Auth e RPC sono una base solida; mancano hardening CSRF/rate-limit/env validation/GDPR e constraint difensivi DB.

## Parte 4 - Performance

### Rendering e client components

Quasi tutte le pagine app sono client component. Questo semplifica sviluppo, ma aumenta bundle e carico browser. Dashboard, report e import sono particolarmente pesanti.

### Query duplicate

Dashboard fa molte query separate: conti, categorie, transazioni, sei mesi, budget, ricorrenti, compleanni, prestiti, previsioni. Per uso piccolo e ok; con storico grande diventa costoso.

### Query N+1

Non ci sono N+1 classiche in loop remoto evidenti per tutte le righe, ma ci sono pattern:

- caricamento peers transazioni separato;
- mappe client-side dopo query ampie;
- report che carica `transactions.select('*')` per periodi larghi.

### Cache

Non c'e una strategia cache applicativa. Gli hook fetchano da Supabase e tengono stato locale. Nessun React Query/SWR. Nessuna invalidazione centralizzata.

### Memo

Uso di `useMemo` presente, utile. Ma spesso compensa dataset caricati troppo ampi nel client.

### Bundle

Dipendenze pesanti:

- Recharts;
- XLSX;
- PapaParse;
- date-fns;
- lucide.

Senza lazy loading mirato, le pagine import/report possono incidere. App Router fa splitting per route, ma dentro singole route i file sono grandi.

### Server Components, Suspense, streaming

Uso molto limitato. Gran parte della UI e client-side. Per dashboard/report futuri sarebbe utile spostare lettura aggregata server-side.

### Performance DB

Rischi per 20 anni di storico:

- `select('*')` su transazioni;
- aggregazioni lato client;
- export completo client-side;
- nessuna materialized view;
- indici non ancora ottimizzati per query report.

### Voto performance

5.5/10.

Motivazione: probabilmente sufficiente ora, ma non pronta per dataset grandi senza refactor.

## Parte 5 - UX

### Dashboard

Punti forti:

- overview ricca;
- KPI, grafici, conti, movimenti, scadenze;
- design moderno.

Rischi UX:

- troppa informazione in una sola pagina;
- alcuni dati hanno criteri non spiegati;
- mancano stati "ultimo aggiornamento" e "fonte calcolo";
- previsione e report potrebbero confondere se i saldi non sono riconciliati.

### Transazioni

Punti forti:

- CRUD completo;
- filtri;
- import CSV;
- supporto transfer;
- raggruppamento per data.

Rischi:

- dialog molto denso;
- import CSV accetta solo formato Aurora ma non guida abbastanza;
- transfer old/new model puo apparire ambiguo;
- editing transfer storico rischia confusione.

### Report

Punti forti:

- periodo custom;
- categorie;
- confronto annuale;
- export CSV.

Rischi:

- criterio contabile non esplicitato;
- confronto annuale solo spese;
- non c'e drill-down dal grafico al movimento;
- report e dashboard possono divergere.

### Budget

Punti forti:

- mensile;
- progress bar;
- riepilogo.

Rischi:

- sottocategorie/parent budget non pienamente chiariti;
- non supporta rollover;
- non supporta budget per conto o annuali.

### Prestiti

Punti forti:

- dato/ricevuto;
- pagamenti parziali;
- stato saldato.

Rischi:

- non integrato con movimenti contabili;
- l'utente potrebbe aspettarsi impatto su saldo.

### Ricorrenti

Punti forti:

- frequenze;
- auto-create;
- scadenze.

Rischi:

- dipende da job server;
- mancano log visibili all'utente;
- manca anteprima prossime occorrenze.

### Import

Punti forti:

- import Bancoposta/Amex avanzato;
- rilevamento trasferimenti;
- anteprima;
- suggerimento categorie.

Rischi:

- molto specifico;
- se nome conto cambia, il flusso si rompe;
- deduplica non spiegata;
- errori batch possono essere difficili da recuperare.

### Export/Impostazioni

Punti forti:

- CSV;
- backup JSON;
- profilo;
- rigenera categorie.

Rischi:

- export CSV esclude movimenti con `transfer_peer_id`;
- cancellazione account non chiarisce che Auth user resta;
- manca restore backup.

### Notifiche

Punti forti:

- email ricorrenti/compleanni.

Rischi:

- nessun pannello preferenze notifiche;
- nessun log visibile;
- nessun test invio.

### Voto UX

7/10.

Motivazione: UI ricca e gradevole, ma alcuni flussi critici non spiegano abbastanza le conseguenze contabili.

## Parte 6 - Qualita Codice

### Leggibilita

Il codice e leggibile a livello locale: nomi chiari, Tailwind coerente, funzioni helper. Il problema e la scala dei file.

### Complessita

Alta in:

- `transactions/page.tsx`;
- `dashboard/page.tsx`;
- `import-estratti/page.tsx`;
- `reports/page.tsx`.

Questi file mescolano:

- fetch;
- aggregazioni;
- form;
- validation;
- parsing;
- rendering;
- stato dialog;
- business rules.

### Magic strings e numbers

Presenti:

- nomi conto `Bancoposta`, `Carta di Credito`;
- pattern Amex;
- label categorie;
- colori;
- soglie UI;
- criteri mese/giorni.

Vanno spostati in configurazioni tipate.

### Error handling

Buono nei form principali con toast. Meno buono per:

- errori silenziati in auth profile fetch;
- batch import;
- notifiche cron;
- report quando una query fallisce parzialmente.

### Tipizzazione

Discreta ma non robusta:

- tipi DB ampi;
- Zod presente;
- `any` nei tooltip e componenti grafico;
- tipi DB non garantiti automaticamente;
- alcuni cast evitano problemi invece di modellare il dato.

### Voto qualita codice

5.5/10.

Motivazione: codice produttivo, ma troppo concentrato e poco testabile.

## Parte 7 - Manutenibilita

### Tempo per capire il progetto

Un nuovo sviluppatore:

- 1-2 giorni per capire struttura generale;
- 3-5 giorni per capire CRUD e Supabase;
- 1-2 settimane per capire transazioni/import/report;
- 2-4 settimane per intervenire in sicurezza sul modello contabile.

### Cosa rallenta

- Pagine enormi.
- Logica dominio non isolata.
- Modello transfer storico.
- Nessun test.
- Query sparse.
- Nessun documento architetturale ufficiale, esclusi audit appena creati.
- Importatori molto specifici dentro UI.
- Nessuna storybook/component library.

### Voto manutenibilita

5/10.

Motivazione: il progetto e capibile, ma rischioso da modificare senza rompere calcoli o flussi.

## Parte 8 - Scalabilita

### 100.000 transazioni

Non pronto senza ottimizzazioni. Servono:

- paginazione server-side;
- aggregazioni SQL;
- indici compositi;
- report incrementali;
- evitare `select('*')`.

### 500 conti

Possibile a DB, ma UI conti/dashboard diventerebbero rumorose. Servono search, gruppi, archiviazione, virtualizzazione.

### 200 categorie

Possibile, ma select e report devono supportare ricerca, gerarchia, bulk edit.

### 20 anni di storico

Serve architettura report robusta:

- monthly snapshots;
- materialized views;
- filtri server;
- export asincrono.

### Report complessi e grafici

Oggi sono lato client. Per grafici evoluti servono endpoint/report service.

### Investimenti, mutui, portafoglio

Il modello attuale non basta. Servono nuovi domini:

- asset;
- liabilities;
- positions;
- transactions finanziarie;
- quote/prezzi;
- ammortamenti;
- interessi;
- valuta.

### Budget evoluti

Servono:

- budget ricorrenti;
- rollover;
- categorie parent/child;
- envelope;
- previsioni;
- alert.

### Voto scalabilita

5.5/10.

Motivazione: Supabase/Postgres puo scalare, ma il codice client e il modello dominio devono maturare.

## Parte 9 - Test

### Test esistenti

Non risultano test applicativi:

- nessuno script `test` in `package.json`;
- nessuna suite unit/integration/e2e rilevata;
- nessun config Vitest/Jest/Playwright nel repo.

### Impatto

Critico per una app finanziaria. Senza test:

- ogni refactor del modello transfer e rischioso;
- ogni cambio report puo alterare totali;
- import/export non sono garantiti;
- regressioni UX/API non vengono intercettate.

### Strategia consigliata

1. Unit test pure functions:
   - date range;
   - parsing importi;
   - classificazione transfer;
   - aggregazioni mensili;
   - categorizzazione.

2. Integration test RPC/API:
   - create income;
   - create expense;
   - create transfer;
   - update transaction;
   - delete transaction;
   - ownership cross-user negata;
   - rollback su errore.

3. E2E smoke:
   - login;
   - crea conto;
   - crea transazione;
   - dashboard aggiornata;
   - report coerente.

4. Import tests:
   - Bancoposta;
   - Amex;
   - CSV Aurora;
   - NotaFacile futuro.

5. Snapshot contabili:
   - dataset fixture con totali attesi per mese.

### Voto test

2/10.

Motivazione: assenza quasi totale.

## Parte 10 - Roadmap Professionale

### CRITICO

| Intervento | Beneficio | Tempo stimato | Rischio | Impatto |
|---|---|---:|---|---|
| Definire modello contabile canonico transfer/saldi iniziali | Elimina ambiguita strutturale | 2-4 giorni analisi + 2-5 giorni implementazione futura | Alto | Molto alto |
| Aggiungere test minimi su RPC/API transazioni | Riduce regressioni finanziarie | 3-5 giorni | Medio | Molto alto |
| Centralizzare calcoli report mensili | Una fonte di verita | 3-6 giorni | Medio | Molto alto |
| Introdurre backup/restore operativo documentato | Sicurezza dati personali | 1-2 giorni | Basso | Alto |
| Hardening constraint DB | Impedisce dati invalidi | 2-4 giorni | Medio | Alto |

### ALTO

| Intervento | Beneficio | Tempo stimato | Rischio | Impatto |
|---|---|---:|---|---|
| Spezzare `transactions/page.tsx` in feature components/hooks | Manutenibilita | 3-6 giorni | Medio | Alto |
| Spezzare dashboard/report/import | Performance e leggibilita | 5-10 giorni | Medio | Alto |
| Creare service layer `transactions`, `reports`, `imports` | Responsabilita chiare | 4-8 giorni | Medio | Alto |
| Aggiungere indici compositi transazioni | Performance storico | 1 giorno + test | Basso | Alto |
| Validazione env centralizzata | Deploy piu sicuri | 0.5-1 giorno | Basso | Medio |
| Rate limit/CSRF hardening API | Sicurezza | 1-3 giorni | Medio | Medio/Alto |

### MEDIO

| Intervento | Beneficio | Tempo stimato | Rischio | Impatto |
|---|---|---:|---|---|
| React Query/SWR per fetch e cache | Meno fetch duplicati | 2-5 giorni | Medio | Medio |
| Export asincrono per dataset grandi | Scalabilita | 2-4 giorni | Medio | Medio |
| Preferenze notifiche | UX/privacy | 2-3 giorni | Basso | Medio |
| Audit log visibile | Fiducia e debug | 2-4 giorni | Basso | Medio |
| Import framework generico | Nuove banche/NotaFacile | 5-10 giorni | Medio | Alto |
| Documentazione architettura | Onboarding | 1-2 giorni | Basso | Medio |

### BASSO

| Intervento | Beneficio | Tempo stimato | Rischio | Impatto |
|---|---|---:|---|---|
| Storybook o catalogo componenti | UI governance | 2-4 giorni | Basso | Medio |
| Pulizia magic colors/strings | Coerenza | 1-2 giorni | Basso | Basso/Medio |
| Empty/error states piu dettagliati | UX | 1-3 giorni | Basso | Medio |
| Keyboard shortcuts/accessibilita avanzata | Qualita | 2-4 giorni | Basso | Medio |
| Privacy/GDPR pages | Compliance personale | 1-2 giorni | Basso | Medio |

## Raccomandazione Finale

Aurora 5.0 ha gia abbastanza sostanza per uso personale controllato, ma non ancora abbastanza garanzie per essere il gestionale finanziario definitivo dei prossimi 10 anni senza una fase di consolidamento.

La priorita non dovrebbe essere aggiungere nuove feature. Dovrebbe essere:

1. stabilizzare modello contabile;
2. centralizzare calcoli;
3. testare transazioni/report/import;
4. rafforzare database;
5. ridurre complessita delle pagine.

## Risposta alla domanda finale

Lo userei come mio gestionale personale per i prossimi 10 anni?

Non ancora.

Lo userei oggi solo come app personale in fase beta, con backup frequenti e riconciliazione periodica. Tecnicamente il progetto e promettente, ma per affidargli 10 anni di storico finanziario servono test, constraint DB, modello contabile non ambiguo, report centralizzati e una struttura codice piu modulare. Senza questi elementi, il rischio non e che l'app non funzioni domani: e che tra 2-3 anni diventi difficile capire se un numero e sbagliato, perche e sbagliato, e come correggerlo senza rompere altro.
