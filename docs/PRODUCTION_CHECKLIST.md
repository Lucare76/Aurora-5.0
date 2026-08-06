# Checklist produzione — Aurora 5.0

Questo documento elenca i controlli da effettuare prima di un deploy in produzione. Ogni voce va verificata manualmente o con i comandi indicati.

---

## Assistente finanziario Aurora 6.0

- [ ] Lasciare `FINANCIAL_ASSISTANT_ENABLED=false` finché la UI chat e i controlli di produzione non sono approvati
- [ ] Verificare che `PRIVATE_FINANCE_ACCOUNT_EMAIL` sia valorizzata solo negli ambienti autorizzati
- [ ] Confermare che gli endpoint `/api/financial-assistant/query`, `/api/financial-assistant/chat` e `/api/financial-assistant/capabilities` rispondano in sola lettura
- [ ] Verificare feature flag fail-closed: nessuna pagina, comando o capability quando `FINANCIAL_ASSISTANT_ENABLED=false`
- [ ] Eseguire test parser: normalizzazione, accenti, punteggiatura, intent, confidenza, prompt injection
- [ ] Eseguire test periodi: mese corrente, mese scorso, ultimi 3/6/12 mesi, input ambigui
- [ ] Eseguire test importi: `2000`, `2.000`, `2.000,50`, `2 mila euro`, `€ 2.000`
- [ ] Verificare scope: PERSONAL sempre disponibile, AURORA/ADI solo per account autorizzati
- [ ] Verificare che richieste di scrittura producano risposta sicura e nessuna mutazione
- [ ] Verificare che evidenze e citazioni derivino solo dal risultato server
- [ ] Verificare mobile 320/360/390/430 px, tastiera, focus, aria-live e zoom 200%
- [ ] Verificare errori sanitizzati: 401, 403, 429, unsupported, input mancante, errore interno
- [ ] Controllare log applicativi sanitizzati: nessun importo dettagliato, email, token o ID completo

---

## 1. Dipendenze e sicurezza

- [ ] `npm audit` non riporta vulnerabilità HIGH o CRITICAL non analizzate
- [ ] `npm ls next` mostra la versione corrente (`^16.2.12`)
- [ ] `npm ls sharp` mostra `^0.35.3`
- [ ] Il file `package.json` contiene l'override `"sharp": "^0.35.3"`
- [ ] Non ci sono dipendenze con licenza incompatibile (GPL, AGPL, ecc.)

---

## 2. Variabili d'ambiente

- [ ] `NEXT_PUBLIC_SUPABASE_URL` configurata nel provider di hosting
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurata nel provider di hosting
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurata **solo** lato server (non esposta al browser)
- [ ] Nessun secret hardcodato nel codice sorgente
- [ ] Il file `.env.local` non è committato (verificare `.gitignore`)

---

## 3. Build TypeScript

```bash
npx tsc --noEmit
```

- [ ] Exit 0, zero errori

---

## 4. Test

```bash
npx vitest run
```

- [ ] Tutti i test passano
- [ ] Coverage ≥ soglie configurate in `vitest.config.ts`

---

## 5. Build di produzione

```bash
npm run build
```

- [ ] Build completa senza errori
- [ ] Nessun warning critico (missing keys, invalid imports)
- [ ] Bundle size dei chunk principali non supera soglie ragionevoli

---

## 6. Sicurezza HTTP

Verificare in produzione con gli header di risposta:

- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY`
- [ ] `X-XSS-Protection: 1; mode=block`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy: camera=(), microphone=(), geolocation=()`

Configurati in `next.config.ts` nella sezione `headers()`.

---

## 7. Autenticazione

- [ ] Ogni route API effettua `supabase.auth.getUser()` e restituisce 401 se non autenticato
- [ ] Le route `/api/backup` e `/api/restore` richiedono autenticazione
- [ ] Il middleware `src/proxy.ts` chiama `updateSession` per il refresh del token
- [ ] La chiave di servizio non è usata nel browser (solo in route API server-side)

---

## 8. Row Level Security (RLS)

- [ ] RLS abilitata su tutte le tabelle (verificare `supabase/migrations/00001_initial_schema.sql`)
- [ ] Le policy usano `auth.uid() = user_id` per l'isolamento tra utenti
- [ ] Nessuna tabella ha RLS disabilitata salvo quelle pubbliche (se presenti)

---

## 9. Pagine di sistema

- [ ] `src/app/not-found.tsx` esiste e mostra messaggio italiano con link alla dashboard
- [ ] `src/app/error.tsx` esiste e mostra messaggio italiano con pulsante "Riprova"

---

## 10. Localizzazione italiana

- [ ] Nessuna stringa tecnica inglese (enum uppercase, chiavi interne) esposta all'utente
- [ ] `DataQualityLevel` usa `dataQualityLabel()` in dashboard e financial-health
- [ ] Tipo notifica nel dialog mute usa `NOTIFICATION_META[type]?.label`
- [ ] Nomi collection nel report restore usano `collectionLabel()`
- [ ] Tutti i messaggi di errore rivolti all'utente sono in italiano

---

## 11. PWA e manifest

- [ ] `public/manifest.json` presente e valido
- [ ] `public/favicon.svg` presente
- [ ] `src/app/layout.tsx` referenzia `/manifest.json` e `/favicon.svg`
- [ ] `<html lang="it">` nel layout radice

---

## 12. Accessibilità

- [ ] Le pagine principali hanno `<h1>` visibile
- [ ] Le immagini decorative hanno `alt=""` o `aria-hidden="true"`
- [ ] I modali usano `role="dialog"` e `aria-modal="true"`
- [ ] I link e pulsanti hanno testo accessibile o `aria-label`
- [ ] Il focus outline è visibile (non rimosso con `outline: none` senza alternativa)

---

## 13. Responsive

- [ ] Dashboard leggibile su mobile (< 640px)
- [ ] Tabelle con overflow-x su schermi stretti
- [ ] Il menu laterale funziona su mobile (collassabile)
- [ ] I dialog non escono dallo schermo su mobile

---

## 14. Performance

- [ ] Le pagine principali usano React Suspense per il loading
- [ ] Le API route critiche (transactions, financial-health) hanno query con indici appropriati
- [ ] Nessuna query N+1 evidente

---

## 15. Export e backup

- [ ] Export CSV funziona per transazioni
- [ ] Export Excel funziona per report
- [ ] Backup JSON completo si scarica senza errori
- [ ] Dry-run restore funziona su un account di test
- [ ] Il restore richiede conferma con frase specifica

---

## 16. Financial Health

- [ ] Il punteggio viene calcolato correttamente su dati reali
- [ ] Il disclaimer "non costituisce consulenza finanziaria" è visibile nella pagina
- [ ] La qualità dei dati mostra etichette italiane (non `GOOD`, `EXCELLENT`, ecc.)

---

## 17. Data Integrity

- [ ] La scansione non modifica dati (solo lettura)
- [ ] Le issue possono essere prese in carico, ignorate o risolte manualmente
- [ ] Nessuna correzione automatica viene applicata

---

## 18. Scenari

- [ ] Il disclaimer "le simulazioni non modificano dati reali" è visibile
- [ ] Il calcolo funziona con scenari di test
- [ ] Gli scenari archiviati non appaiono nella lista principale

---

## 19. Notifiche

- [ ] Il refresh delle notifiche funziona
- [ ] Il silenziamento per tipo usa le etichette italiane
- [ ] Le notifiche critiche sono visibili nel tab dedicato

---

## 20. Posso permettermelo? (Affordability)

- [ ] La pagina `/affordability` è accessibile agli utenti autenticati
- [ ] Il form accetta modalità immediata e rateale
- [ ] La valutazione restituisce una classificazione e un punteggio
- [ ] Il grafico di proiezione mostra baseline e scenario
- [ ] L'API `POST /api/affordability/calculate` restituisce 401 senza autenticazione
- [ ] L'API non crea transazioni né modifica saldi
- [ ] La voce di menu "Permettermelo?" è presente nella sidebar e nel menu "Altro"
- [ ] La voce è ricercabile nel command menu (Ctrl+K)
- [ ] Il disclaimer è visibile nel risultato
- [ ] I dati insufficienti mostrano avvisi appropriati

---

## 21. Valutazione auto (Car Affordability)

- [ ] La pagina `/affordability` mostra il selettore "Acquisto generico" / "Auto"
- [ ] Il form auto raccoglie: veicolo, riduzioni, pagamento, spese iniziali, assicurazione, bollo, carburante, manutenzione, altri costi, auto attuale, valore residuo
- [ ] La valutazione restituisce TCO, costo medio mensile, costo per km e classificazione
- [ ] Il confronto pagamento (immediato vs. finanziamento) appare quando la modalità è "Finanziamento"
- [ ] Il confronto auto A vs. B appare quando è compilato il secondo veicolo
- [ ] L'API `POST /api/affordability/car/calculate` restituisce 401 senza autenticazione
- [ ] L'API non crea transazioni né modifica saldi
- [ ] Le voci di costo mancanti sono segnalate nell'output
- [ ] Il disclaimer è visibile nel risultato
- [ ] `npx tsc --noEmit` → 0 errori

---

## 22. Valutazione casa (Home Affordability)

- [ ] La pagina `/affordability` mostra il selettore "Acquisto generico" / "Auto" / "Casa"
- [ ] Il form casa raccoglie immobile, prezzo, contributi, pagamento, mutuo, costi iniziali, lavori, arredamento, condominio, utenze, assicurazione, imposte, manutenzione, abitazione attuale e valore residuo
- [ ] Il pagamento immediato calcola esborso iniziale e liquidità residua
- [ ] Il mutuo calcola rata, costo finanziario, costo abitativo mensile e picchi di liquidità
- [ ] Maggiore anticipo, minore anticipo e durata mutuo diversa sono confrontabili tramite il motore
- [ ] Lavori e arredamento rinviabile generano alternative deterministiche
- [ ] Affitto o mutuo attuale riducono correttamente l'incremento reale mensile
- [ ] Valore residuo e debito residuo sono mostrati come stime inserite dall'utente
- [ ] I costi mancanti riducono la confidenza e sono visibili
- [ ] L'API `POST /api/affordability/home/calculate` restituisce 401 senza autenticazione
- [ ] L'API non crea transazioni, mutui, prestiti, notifiche o snapshot
- [ ] Mobile, dark mode, tastiera e screen reader non presentano blocchi evidenti
- [ ] Il disclaimer è visibile nel risultato

---

## 23. Valutazione vacanza (Travel Affordability)

- [ ] La pagina `/affordability` mostra il selettore "Acquisto" / "Auto" / "Casa" / "Vacanza"
- [ ] Il form vacanza raccoglie viaggio, trasporti, alloggio, pasti, attività, extra e calendario pagamenti
- [ ] Durata viaggio e notti sono calcolate automaticamente
- [ ] Il budget pasti giornaliero viene moltiplicato per giorni e viaggiatori
- [ ] I pagamenti distribuiti usano date reali nella simulazione
- [ ] L'accantonamento mensile suggerito cambia in base ai mesi alla partenza
- [ ] Il budget massimo viene mostrato come intervallo prudenziale quando i dati sono sufficienti
- [ ] Il confronto Vacanza A vs Vacanza B non suggerisce destinazioni
- [ ] L'API `POST /api/affordability/travel/calculate` restituisce 401 senza autenticazione
- [ ] L'API non crea transazioni, notifiche o modifiche ai saldi
- [ ] Nessuna API esterna, AI, prezzo online o conversione automatica viene usata

---

## 24. Git e commit

- [ ] `git diff --check` non riporta spazi o newline extra
- [ ] Nessun file `.env*` committato
- [ ] Il branch `main` è aggiornato
- [ ] Nessun secret nei commit recenti (`git log -p | grep -i secret`)

---

## Note

- Il deploy non deve applicare migration remote senza verifica manuale.
- Le migration vanno applicate nell'ambiente target con `supabase db push` solo dopo revisione.
- I dati reali non vanno mai modificati durante test o debug.
