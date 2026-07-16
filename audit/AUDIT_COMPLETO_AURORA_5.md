# Audit completo Aurora 5.0

Data audit: 2026-07-15  
Ambito: repository locale `Aurora-5.0`, codice Next.js/TypeScript, API Route, schema Supabase e migration.  
Vincoli rispettati: nessuna modifica al codice applicativo, nessuna modifica al database, nessuna migration, nessun commit, nessun push.

## Executive summary

Aurora 5.0 è una applicazione Next.js App Router con autenticazione Supabase, pagine CRUD per conti, categorie, transazioni, budget, ricorrenti, prestiti, compleanni, dashboard, report, esportazione dati e due flussi di importazione CSV/XLSX. La base dati usa RLS per isolamento utente e funzioni PostgreSQL `SECURITY DEFINER` per le mutazioni finanziarie atomiche.

Il rischio contabile principale è la semantica non stabile del campo `transactions.transfer_peer_id`. Nelle versioni precedenti era una FK verso una transazione peer; dopo `supabase/migrations/00009_fix_transfer_peer_id_fkey.sql:1` la FK viene rimossa perché le RPC attuali salvano in `transfer_peer_id` l'UUID del conto destinazione. Quindi nello stesso database possono convivere:

- righe vecchie con `transfer_peer_id = id transazione peer`;
- righe nuove con `transfer_peer_id = id conto destinazione`;
- normali entrate/uscite con `transfer_peer_id` valorizzato, che i report escludono dai totali.

Questa ambiguità è la causa più probabile delle differenze mensili con NotaFacile, soprattutto se NotaFacile conta o classifica giroconti, pagamenti carta, polizze e movimenti previdenziali con un criterio diverso.

Secondo rischio: l'importatore `src/app/(app)/import-estratti/page.tsx` è specifico per Bancoposta e American Express, non per NotaFacile. Non è stato trovato alcun importatore NotaFacile nel repository. L'import storico potrebbe quindi essere stato fatto via SQL Editor, CSV Supabase, script esterno non incluso, API o import manuale. Senza il file sorgente NotaFacile non è possibile stabilire la causa con certezza, ma il progetto contiene diversi punti in cui una differenza di criterio può produrre scostamenti mensili.

## Architettura

- Framework: Next.js 16 App Router, React 19, TypeScript.
- UI: pagine client sotto `src/app/(app)/*`, componenti UI locali sotto `src/components`.
- Auth: Supabase SSR/client, contesto React in `src/contexts/AuthContext.tsx`.
- Database: Supabase PostgreSQL, migration in `supabase/migrations`.
- API server:
  - `src/app/api/transactions/route.ts`: POST/PATCH/DELETE verso RPC atomiche.
  - `src/app/api/accounts/route.ts`: POST minimale per account.
  - `src/app/api/notifications/daily-check/route.ts`: ricorrenze e reminder compleanni via service role.
- Middleware/proxy auth: `src/proxy.ts`, `src/lib/supabase/middleware.ts`.
- Import:
  - `src/app/(app)/import-estratti/page.tsx`: Bancoposta XLSX e Amex CSV.
  - `src/app/(app)/transactions/page.tsx`: import CSV Aurora esportato.

## Funzionalità sviluppate

| Funzionalità | Stato | File principali | Tabelle/RPC | Criticità | Rischio |
|---|---|---|---|---|---|
| Autenticazione | Completa | `src/contexts/AuthContext.tsx`, `src/app/(auth)/*`, `src/proxy.ts` | `profiles`, trigger `handle_new_user`, `create_default_categories` | `createClient()` viene creato nel render del provider; non blocca ma può causare dipendenze instabili | Medio |
| Gestione profilo | Parziale | `src/app/(app)/settings/page.tsx` | `profiles` | Salvataggio manuale; nessuna sincronizzazione immediata del context dopo save | Basso |
| Conti | Parziale/fragile | `src/app/(app)/accounts/page.tsx`, `src/hooks/use-accounts.ts` | `accounts` | `balance` è saldo memorizzato e modificabile direttamente dal client; non esiste campo saldo iniziale | Alto |
| Categorie e sottocategorie | Parziale | `src/app/(app)/categories/page.tsx`, `src/hooks/use-categories.ts` | `categories`, `create_default_categories` | Nessun vincolo DB su tipo ammesso o coerenza parent/user; controllo solo UI/RLS | Medio |
| Entrate/uscite | Parziale | `src/app/(app)/transactions/page.tsx`, `src/app/api/transactions/route.ts` | `transactions`, `create_transaction_atomic`, `update_transaction_atomic`, `delete_transaction_atomic` | Le mutazioni recenti passano da API atomica; vecchie righe/import possono non rispettare modello corrente | Alto |
| Trasferimenti | Fragile | `transactions/page.tsx`, `api/transactions/route.ts`, migration 00009 | `transactions.transfer_peer_id` | Semantica mista: id conto destinazione vs id transazione peer; nessuna FK dopo 00009 | Critico |
| Saldo conti | Fragile | `accounts/page.tsx`, RPC, hooks | `accounts.balance` | Saldo progressivo memorizzato; manca ricalcolo canonico e audit saldo iniziale | Alto |
| Dashboard | Parziale | `src/app/(app)/dashboard/page.tsx`, `useTransactions` | `transactions`, `accounts`, `budgets`, `recurring_rules`, `loans`, `birthdays` | Usa criterio `!transfer_peer_id` per totali, quindi può divergere da report/import storici | Alto |
| Report | Parziale | `src/app/(app)/reports/page.tsx` | `transactions`, `categories` | Esclude tutte le righe con `transfer_peer_id`; in modello nuovo esclude i transfer, ma in modello vecchio esclude anche income/expense peer | Alto |
| Budget | Parziale | `src/app/(app)/budgets/page.tsx` | `budgets`, `transactions` | Somma spese per categoria solo se `!transfer_peer_id`; non aggrega sottocategorie al parent per budget | Medio |
| Ricorrenti | Parziale | `src/app/(app)/recurring/page.tsx`, `daily-check` | `recurring_rules`, `create_recurring_transaction` | Auto-create solo via endpoint schedulato; funzione non valida ownership quando service role passa dati | Medio |
| Prestiti | Parziale | `src/app/(app)/loans/page.tsx` | `loans`, `loan_payments` | Pagamenti prestiti non generano transazioni contabili; possono non incidere sui report/saldi | Medio |
| Compleanni | Completa per CRUD | `birthdays/page.tsx`, `daily-check` | `birthdays`, `birthday_reminder_log` | Accessoria; notifica dipende da variabili Resend e cron | Basso |
| Notifiche | Parziale | `api/notifications/daily-check/route.ts` | service role, `birthday_reminder_log`, `recurring_rules` | Endpoint protetto da secret; rischio operativo se secret assente o cron non configurato | Medio |
| Import estratti | Fragile | `import-estratti/page.tsx`, `transactions/page.tsx` | `/api/transactions`, `transactions` | Specifico Bancoposta/Amex; deduplica debole; nessun import NotaFacile trovato | Critico |
| Esportazione dati | Parziale | `settings/page.tsx`, `reports/page.tsx` | `transactions`, varie | Export CSV esclude `transfer_peer_id`; backup JSON completo | Medio |
| Cancellazione account | Parziale | `settings/page.tsx`, migration 00007 | `delete_user_account` | Elimina dati applicativi ma non elimina `auth.users`; funzione SECURITY DEFINER richiede review grants | Medio |
| Sicurezza/RLS | Buona ma incompleta | migration 00001-00010 | tutte le tabelle | RLS base presente; mancano constraint CHECK e vincoli cross-table su ownership | Medio/Alto |
| Test automatici | Non funzionante/assente | `package.json` | n/a | Nessuno script test; nessuna suite rilevata | Alto |

## Modello contabile reale

### Tabelle e valori ammessi

`src/types/database.ts` definisce:

- `TransactionType = 'income' | 'expense' | 'transfer'`;
- `AccountType = 'checking' | 'savings' | 'cash' | 'credit' | 'investment' | 'other'`;
- `CategoryType = 'income' | 'expense' | 'both'`.

Nel DB però le colonne `type` sono `text` senza `CHECK` in `supabase/migrations/00001_initial_schema.sql`. Le RPC validano `p_type`, ma import manuali SQL o scritture dirette potrebbero inserire valori non validi.

### Entrate e uscite

Le RPC in `supabase/migrations/00003_fix_atomic_functions.sql` applicano:

- income: `accounts.balance += amount`;
- expense: `accounts.balance -= amount`;
- amount deve essere positivo.

La API `src/app/api/transactions/route.ts` valida `amount.positive()` e chiama `create_transaction_atomic`, `update_transaction_atomic`, `delete_transaction_atomic`.

### Trasferimenti

Il modello attuale delle RPC non crea due transazioni. Crea una sola riga:

- `type = 'transfer'`;
- `account_id = conto sorgente`;
- `transfer_peer_id = conto destinazione`;
- saldo sorgente diminuito;
- saldo destinazione aumentato.

Questo è esplicitato dalla migration `00009`, che rimuove la FK perché `transfer_peer_id` ora contiene un UUID conto, non una transazione. Tuttavia parte della UI contiene ancora logica compatibile col vecchio modello, ad esempio `transactions/page.tsx` carica eventuali peer transaction e poi fallback su conto destinazione (`transactions/page.tsx:279`, `transactions/page.tsx:940`).

Rischio: ogni query che interpreta `transfer_peer_id` come "presenza di peer" invece che come "conto destinazione" cambia criterio contabile.

### Cancellazione e modifica

Le funzioni atomiche reverse/apply sono corrette per il modello a riga singola. Il problema è il comportamento su dati importati precedentemente in vecchio modello a due righe:

- una vecchia coppia income/expense con `transfer_peer_id` valorizzato viene esclusa dai report;
- una riga vecchia che punta a transazione peer può essere trattata dalla UI come transfer;
- la migration 00009 non normalizza i dati esistenti, rimuove solo il vincolo.

### Saldi iniziali

Non esiste un campo `initial_balance`. Il saldo iniziale può essere:

- inserito direttamente in `accounts.balance`;
- importato come transazione;
- dedotto come `accounts.balance - somma effetti transazioni`.

Questo rende fragile la riconciliazione con NotaFacile. Se NotaFacile mostra report mensili escludendo saldi iniziali, ma Aurora li ha importati come entrate, i mesi storici non combaceranno.

## Importazione NotaFacile

Risultato ricerca repository: nessun riferimento a `NotaFacile` o `notafacile`.

Elementi import presenti:

- `src/app/(app)/import-estratti/page.tsx`: Bancoposta e American Express.
- `src/app/(app)/transactions/page.tsx`: import CSV esportato da Aurora.
- `src/app/(app)/settings/page.tsx`: export CSV/backup JSON.
- `supabase/seed.sql`: nessun dato storico, solo nota che le categorie default vengono create via RPC.

Conclusione: l'import NotaFacile non è riproducibile dal repository attuale. Potrebbe essere avvenuto via SQL Editor, import CSV Supabase, script locale non incluso, API, migration rimossa o inserimento manuale.

## Possibili cause della discrepanza mensile

### 1. Trasferimenti e pagamenti carta

Probabilità: molto alta.

Evidenze:

- Report e hook escludono `transfer_peer_id` (`use-transactions.ts:49`, `reports/page.tsx:223`, `reports/page.tsx:227`).
- Il nuovo transfer salva in `transfer_peer_id` il conto destinazione (`00009_fix_transfer_peer_id_fkey.sql`).
- Import Bancoposta/Amex intercetta pagamento Amex e crea transfer (`import-estratti/page.tsx:369`, `import-estratti/page.tsx:500`).

Impatto: se NotaFacile conta il pagamento carta come uscita e Aurora lo considera transfer, oppure se NotaFacile conta le spese carta ma Aurora conta anche il pagamento carta, lo scostamento mensile può essere pari al saldo carta/pagamento mensile.

### 2. Import NotaFacile non tracciato

Probabilità: alta.

Senza script import non possiamo verificare parsing date, importi, segni e deduplica. Il CSV generico in Transazioni accetta solo formato Aurora e non deduplica (`transactions/page.tsx:623`, `transactions/page.tsx:662`).

### 3. Deduplica debole

Probabilità: alta.

`import-estratti` deduplica su `account_id|date|amount` (`import-estratti/page.tsx:430` circa). Due operazioni reali identiche stesso giorno stesso conto possono essere escluse; duplicati con descrizioni/date leggermente diverse possono passare.

### 4. Saldi iniziali

Probabilità: alta.

Nessun campo saldo iniziale. Se l'import NotaFacile ha creato transazioni "saldo iniziale", i report mensili le conteranno come income/expense.

### 5. Date e timezone

Probabilità: media.

Punti positivi: molte date sono costruite con `toLocaleDateString('en-CA')`, evitando `toISOString()` UTC nei filtri mensili.  
Punti fragili:

- `parseDateBP` usa `DD/MM/YYYY`;
- `parseDateAmex` usa `MM/DD/YYYY`;
- il CSV generico accetta solo `YYYY-MM-DD`;
- report aggrega con `new Date(dateStr + 'T00:00:00')`.

Se NotaFacile esporta date in formato diverso o usa data valuta anziché data contabile, i mesi divergono.

### 6. Categorie

Probabilità: media.

Le categorie non cambiano il totale generale, ma budget e report per categoria possono divergere se importate come "Senza categoria" o con tipo errato.

## Database e sicurezza

Punti forti:

- RLS attiva sulle tabelle principali.
- Policy per utente su profili, conti, categorie, transazioni, budget, ricorrenti, prestiti, compleanni.
- RPC finanziarie usano `auth.uid()` e validano ownership di account/categoria/destinazione.
- `adjust_account_balance` revocata da `authenticated` in 00003.

Criticità:

- Mancano `CHECK` su `type`, `amount > 0`, `month 1..12`, `currency`.
- `transfer_peer_id` senza FK dopo 00009, quindi possibili UUID non risolti.
- `delete_transaction_atomic` non viene rigarantita in 00003; se il grant 00002 non è presente o è stato perso, DELETE API può fallire.
- `accounts.balance` è modificabile via RLS dal client nella pagina conti.
- `delete_user_account` è `SECURITY DEFINER`; va verificato grant effettivo e search_path.
- `create_recurring_transaction` usa `p_user_id` esplicito e service role; corretto per job server, ma richiede endpoint secret robusto.

## Migration Supabase in ordine

| Migration | Contenuto | Osservazioni audit |
|---|---|---|
| `00001_initial_schema.sql` | Tabelle principali, RLS, trigger profilo, `adjust_account_balance`, `create_default_categories` | Base completa ma senza `CHECK` sui tipi; `transactions.transfer_peer_id` nasce come FK verso `transactions(id)` |
| `00002_financial_atomic_functions.sql` | Introduce `create/update/delete_transaction_atomic` | Modello transfer gia ambiguo: `transfer_peer_id` viene usato come destinazione nel create/update, ma la FK iniziale era verso transazioni |
| `00003_fix_atomic_functions.sql` | Corregge ownership nei balance update, confronto NULL-safe, revoca `adjust_account_balance` | Migliora sicurezza; non rigarantisce esplicitamente `delete_transaction_atomic` |
| `00004_default_categories_with_subcategories.sql` | Sostituisce categorie default con parent/child | Buono per UX; nessun vincolo DB su coerenza tipo parent/child |
| `00004b_add_missing_subcategories.sql` | Backfill sottocategorie per utenti esistenti | Usa nomi categoria come chiave logica, rischio se nomi personalizzati |
| `00005_birthday_reminder_log.sql` | Log reminder compleanni | Policy service-only con `using(false)` |
| `00006_create_recurring_transaction.sql` | RPC service role per ricorrenti | Crea transazioni e aggiorna saldo, ma non usa la stessa RPC atomica principale |
| `00007_delete_user_account.sql` | Pulizia dati utente | Non elimina `auth.users`; va verificato grant funzione |
| `00008_add_is_hidden_to_accounts.sql` | Flag conti nascosti | Types e query devono restare allineati |
| `00009_fix_transfer_peer_id_fkey.sql` | Rimuove FK `transfer_peer_id` | Criticità massima: consente semantica mista e dati non risolti |
| `00010_loan_payments_policies.sql` | Policy update/delete rate prestiti | Completa RLS loan_payments |

## Dettaglio funzioni atomiche

### `create_transaction_atomic`

Input: account sorgente, tipo, importo, data, descrizione, categoria, note, destinazione, recurring id.  
Validazioni: tipo in `income|expense|transfer`, importo positivo, ownership conto sorgente, ownership conto destinazione per transfer, ownership categoria.  
Operazioni: inserisce una riga in `transactions`; per transfer salva `transfer_peer_id = p_destination_account_id`; aggiorna i saldi; scrive audit log.  
Rollback: implicito nella singola chiamata PL/pgSQL.  
Rischi: il nome `transfer_peer_id` non rappresenta piu un peer transaction; dati old-model possono essere letti in modo sbagliato dai report.

### `update_transaction_atomic`

Input: id transazione e campi opzionali.  
Validazioni: ownership transazione, nuovo conto, destinazione, categoria, importo positivo.  
Operazioni: reverse vecchio effetto, aggiorna riga, applica nuovo effetto.  
Rollback: implicito.  
Rischi: se la transazione vecchia era old-model con peer transaction, la funzione la tratta come modello corrente; può non ripristinare correttamente una coppia storica a due righe.

### `delete_transaction_atomic`

Input: id transazione.  
Validazioni: ownership transazione.  
Operazioni: reverse effetto e rimuove la riga; per transfer sottrae dal conto `transfer_peer_id` se valorizzato.  
Rischi: dopo 00009 va bene per new-model, ma non è ridefinita in 00003. Se la riga è old-model, `transfer_peer_id` è una transazione, non un conto, quindi il reverse destinazione può non avvenire.

### `adjust_account_balance`

Input: conto e importo.  
Stato: revocata a `public`, `anon`, `authenticated` in 00003.  
Rischio: storico recente del codice mostra che era stata chiamata dal client; in produzione può generare 404/permission error. L'uso diretto va evitato.

### `create_recurring_transaction`

Input: user id, conto, categoria, tipo, importo, descrizione, data, recurring id.  
Operazioni: inserisce transazione e aggiorna saldo.  
Rischi: non chiama `create_transaction_atomic`, non gestisce transfer, usa `p_user_id` esplicito perché pensata per service role.

### `delete_user_account`

Input: user id.  
Validazione: `auth.uid() = p_user_id`.  
Operazioni: pulisce dati applicativi in ordine.  
Rischi: non elimina account Auth; serve test grant e comportamento su errori intermedi.

## API server e fiducia nei dati client

`src/app/api/transactions/route.ts` non accetta `user_id` dal client e usa `supabase.auth.getUser()`. La sicurezza principale è demandata alle RPC che validano ownership. È una buona impostazione.

Criticità:

- La route accounts è solo POST e inserisce saldo direttamente.
- Le pagine client CRUD scrivono direttamente su molte tabelle via RLS; sicuro per isolamento utente, ma non sempre sicuro per invarianti contabili.
- Nessuna API read-only centralizzata per report mensili, quindi dashboard/report/budget possono divergere.

## Qualità del codice

Punti positivi:

- Zod e React Hook Form usati ampiamente.
- API transazioni server-side con funzioni atomiche.
- UI copre molti flussi.
- Formati data spesso coerenti `en-CA`.

Criticità:

- Molta logica contabile duplicata tra dashboard, report, transactions e import.
- Nessun modulo centrale per "criterio contabile mensile".
- Nessun test.
- Importatori diversi con regole diverse.
- Semantica ibrida di `transfer_peer_id` gestita con euristiche in UI.

## Priorità di intervento

1. Congelare il modello transfer e migrare i dati a un solo criterio.
2. Eseguire `audit/diagnostica_contabile.sql` su produzione.
3. Recuperare export NotaFacile originale e confrontare mese per mese.
4. Introdurre un campo o tabella per saldo iniziale/account opening balance.
5. Centralizzare i calcoli mensili in una view/RPC read-only.
6. Rafforzare constraint DB.
7. Scrivere test su RPC e report.
8. Creare riconciliazione NotaFacile dedicata.
