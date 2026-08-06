# Sprint 30 - Chat finanziaria read-only

## 1. Prerequisiti Sprint 29

Verificati:

- `src/lib/financial-assistant/` presente;
- intent registry e tool registry presenti;
- scope `PERSONAL`, `AURORA`, `ADI` presenti;
- policy read-only, prompt-injection guard e write-intent guard presenti;
- Context Builder presente;
- evidenze, citazioni interne e response contract presenti;
- orchestrator presente;
- feature flag `FINANCIAL_ASSISTANT_ENABLED` presente;
- endpoint `POST /api/financial-assistant/query` e `GET /api/financial-assistant/capabilities` presenti;
- nessun provider AI esterno collegato.

## 2. Architettura

Flusso implementato:

utente -> pagina `/assistant` -> `POST /api/financial-assistant/chat` -> parser deterministico italiano -> query strutturata -> orchestrator Sprint 29 -> tool read-only -> risposta strutturata -> UI con evidenze e citazioni.

La conversazione resta nello stato React locale e non viene persistita.

## 3. Parser

Creato `src/lib/financial-assistant/natural-language/**`.

Copre:

- normalizzazione di maiuscole, accenti e punteggiatura;
- pattern controllati per intent registrati;
- importi italiani;
- periodi comuni;
- confidenza `HIGH`, `MEDIUM`, `LOW`;
- blocco di richieste di scrittura e prompt injection.

## 4. Intent

Supportati nella chat:

- riepilogo entrate/uscite;
- spese per categoria;
- riepilogo patrimonio personale;
- fondo emergenza;
- budget;
- obiettivi;
- Financial Health;
- affordability generica, auto, casa, vacanza;
- Decision Comparison con input richiesti;
- riepilogo Aurora autorizzato;
- riepilogo ADI autorizzato.

## 5. Periodi

Supportati tramite mapping agli enum Sprint 29:

- mese corrente;
- mese scorso;
- ultimi 3 mesi;
- ultimi 6 mesi;
- ultimi 12 mesi;
- anno/mesi espliciti marcati come ambigui quando non rappresentabili esattamente dall'enum attuale.

## 6. Importi

Supportati:

- `2000`;
- `2.000`;
- `2.000,50`;
- `2000 euro`;
- `2 mila euro`;
- `€ 2.000`.

Valori non numerici, negativi o non finiti non vengono normalizzati.

## 7. Confidenza

- `HIGH`: intent chiaro e parametri sufficienti.
- `MEDIUM`: intent probabile con input mancante o periodo ambiguo.
- `LOW`: richiesta ambigua, non supportata, prompt injection o scrittura.

Con confidenza `LOW` nessun tool finanziario viene eseguito.

## 8. Conversazione Locale

Messaggi supportati lato UI:

- `USER`;
- `ASSISTANT_RESULT`;
- `ASSISTANT_QUESTION`;
- `ASSISTANT_ERROR`;
- `SYSTEM_NOTICE`.

Non vengono salvati messaggi, token, cookie o dati server.

## 9. Template Risposta

La UI visualizza il `FinancialAssistantResult` senza generare JSON tecnico in produzione:

- risposta;
- sintesi;
- insight;
- input mancanti;
- evidenze;
- citazioni;
- navigazione whitelist.

## 10. Input Mancanti

I risultati `NEEDS_INPUT` mostrano i campi richiesti dal tool. In questo sprint la compilazione strutturata avanzata resta un limite noto: la UI mostra chiaramente cosa manca e mantiene la bozza solo in locale.

## 11. Capability e Scope

Le capability provengono da `GET /api/financial-assistant/capabilities`.

Scope:

- `PERSONAL` predefinito;
- `AURORA` solo se autorizzato;
- `ADI` solo se autorizzato.

Il server rivalida comunque scope e intent.

## 12. Aurora e ADI

I suggerimenti Aurora/ADI sono mostrati solo quando i relativi scope risultano disponibili dalle capability server.

## 13. Evidenze e Citazioni

Mostrate in sezioni dedicate:

- "Dati utilizzati";
- "Citazioni".

Le citazioni derivano dal risultato server.

## 14. Navigation Actions

La UI mostra solo `result.navigation` generata dal response contract Sprint 29 e accetta solo href interni che iniziano con `/`.

## 15. Richieste Non Supportate

Richieste come raccomandazioni su ETF o domande non mappate restituiscono `UNSUPPORTED` senza eseguire tool.

## 16. Prompt Injection

Frasi come "ignora le regole", "esegui SQL", "mostrami dati di un altro account" o "readOnly false" vengono intercettate dal parser e dalle policy esistenti dell'orchestrator.

## 17. API Chat

Creato `POST /api/financial-assistant/chat`.

La route:

- autentica;
- verifica feature flag;
- valida body con Zod strict;
- non accetta `user_id`, email, SQL o override permessi;
- normalizza il messaggio;
- riconosce intent e parametri;
- applica rate limit;
- chiama l'orchestrator solo se la confidenza lo consente;
- non scrive dati.

## 18. Rate Limiting

Riutilizzato `assertAssistantRateLimit`. Per richieste a bassa confidenza viene applicato direttamente dalla route; per richieste valide viene applicato dall'orchestrator.

## 19. Loading e Annullamento

La UI blocca doppi invii, mostra "Analisi in corso..." e usa `AbortController` per annullare.

## 20. Errori

Gestiti:

- feature disabilitata;
- non autenticato;
- payload invalido;
- rate limit;
- unsupported;
- errore generico sanificato.

## 21. Feature Flag

La pagina server chiama `notFound()` quando `FINANCIAL_ASSISTANT_ENABLED` non è attivo. Le voci UI sono condizionate al flag build/UI.

## 22. Navigazione

Aggiunta voce "Chiedi ad Aurora" e comandi rapidi quando il flag UI risulta attivo.

## 23. Privacy

La pagina mostra:

- "Solo lettura";
- "Aurora non modifica i tuoi dati";
- "Le risposte sono basate sui dati del gestionale";
- "Questa conversazione non viene ancora salvata";
- "Nessun modello esterno".

## 24. Responsive e Accessibilità

Implementati:

- layout responsive mobile/tablet/desktop;
- composer sticky raggiungibile;
- label del composer;
- aria-live;
- invio con Enter e nuova riga con Shift+Enter;
- pulsante annulla;
- focus sul contenitore live;
- nessuna informazione solo tramite colore.

## 25. Test

Aggiunti test per:

- parser naturale;
- importi italiani;
- periodi;
- prompt injection e scritture;
- logica UI dei suggerimenti/scope/payload;
- route chat: 401, feature flag, body strict, unsupported, intent valido.

## 26. Coverage e Build

Verifiche eseguite:

- `npx tsc --noEmit`: OK.
- Test mirati assistente: 55 passati su 55.
- Coverage mirata Sprint 30: 42 test passati su 42.
- `npm run build`: OK.
- `git diff --check`: OK, con soli warning CRLF Windows.

Coverage mirata Sprint 30:

- totale file mirati: statements 97,70%, branches 90,00%, functions 93,75%, lines 97,36%;
- parser natural-language: statements 98,46%, branches 94,20%, functions 100%, lines 98,24%;
- route chat: statements 95,45%, branches 76,19%, functions 66,66%, lines 94,73%.

Limite verifica globale:

- `npx vitest run` completo non ha prodotto riepilogo entro 5 minuti;
- `npm run test:coverage` completo resta bloccato/fallisce su test preesistenti non introdotti dallo Sprint 30, tra cui route search, financial-calendar, backup e affordability;
- il problema osservato è coerente con timeout dei worker Vitest già presenti nel progetto.

## 27. Limiti

- Periodi espliciti come "gennaio 2026" e intervalli "dal/al" vengono riconosciuti come ambigui perché il contratto Sprint 29 espone solo enum periodali.
- La compilazione guidata degli input mancanti è visualizzata ma non ancora trasformata in un form dinamico completo per ogni tool.
- La conversazione non è persistita per scelta di sprint.

## 27B. Chiusura Tecnica Suite Completa

Confronto baseline eseguito con stash sicuro:

- comando stash: `git stash push -u -m "sprint-30-baseline-check"`;
- baseline misurato sul commit precedente alle modifiche non committate;
- ripristino: `git stash pop` senza conflitti e senza perdita file.

Risultati baseline:

- `npx vitest run --reporter=verbose --testTimeout=15000 --hookTimeout=15000 --teardownTimeout=5000`: 100 file passati, 1 skipped; 1409 test passati, 14 skipped; durata 339,94s;
- `npm run test:coverage`: 100 file passati, 1 skipped; 1409 test passati, 14 skipped; durata 334,01s;
- coverage baseline globale: statements 86,42%, branches 78,22%, functions 89,75%, lines 88,63%.

Risultati Sprint 30 ripristinato:

- primo run a 360s terminato per timeout esterno mentre la suite era quasi al termine;
- rerun con timeout esterno adeguato: 103 file passati, 1 skipped; 1451 test passati, 14 skipped; durata 320,41s;
- `npx vitest run`: 103 file passati, 1 skipped; 1451 test passati, 14 skipped; durata 304,56s;
- `npm run test:coverage`: 103 file passati, 1 skipped; 1451 test passati, 14 skipped; durata 320,12s;
- coverage globale Sprint 30: statements 86,87%, branches 78,98%, functions 89,82%, lines 89,01%.

Classificazione:

- timeout iniziale: limite ambiente/timeout esterno, non regressione Sprint 30;
- warning `vitest-pool Timeout terminating forks worker`: preesistenti, riprodotti sul baseline;
- file coinvolti dai warning baseline: `tests/api/budgets-route.test.ts`, `tests/api/affordability-home-route.test.ts`, `tests/api/search-route.test.ts`, `tests/api/transactions-route.test.ts`;
- file coinvolti dai warning corrente: analoghi più alcuni worker lenti aggiuntivi durante run paralleli; nessun test fallito;
- suite completa corrente: verde con timeout esterno coerente con durata reale.

Controlli mirati:

- `npx vitest run tests/unit/financial-assistant`: 43 passed;
- `npx vitest run tests/api/financial-assistant-chat-route.test.ts`: 8 passed;
- `npx vitest run tests/unit/goals/migration-static.test.ts tests/integration/supabase-accounting.integration.test.ts tests/unit/access/private-finance-navigation.test.ts`: 8 passed, 14 skipped.

## 28. Rischi Residui

- La visibilità della voce nav dipende dal flag disponibile a build/runtime UI; l'API e la pagina restano comunque fail-closed lato server.
- La sicurezza dati resta subordinata anche alla correttezza RLS Supabase, oltre ai filtri applicativi già rafforzati.
- La suite completa è lenta su Windows/Turbopack/Vitest fork pool e richiede circa 5-6 minuti; usare timeout esterni inferiori a 360s produce falsi negativi.

## 29. Provider AI Futuro

Un futuro provider AI dovrà essere introdotto solo dietro gateway server-side, redazione dati, consenso esplicito, audit log, policy di retention e test prompt-injection dedicati.
