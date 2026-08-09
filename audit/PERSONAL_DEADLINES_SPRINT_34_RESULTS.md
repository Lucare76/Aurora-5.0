# Sprint 34 - Scadenze personali

## Obiettivo

Implementare un modulo privato per gestire scadenze personali non contabili in Aurora 6.0.

Il modulo copre documenti, veicoli, salute, famiglia, scuola, abbonamenti, pratiche amministrative e altre scadenze personali. Le scadenze non generano movimenti, non modificano saldi e non entrano nei calcoli finanziari.

## Ambito implementato

- Route privata `/deadlines`.
- API private:
  - `GET /api/deadlines`
  - `POST /api/deadlines`
  - `PATCH /api/deadlines/[id]`
  - `DELETE /api/deadlines/[id]`
- Tabella locale `personal_deadlines`.
- RLS per isolamento utente.
- Accesso vincolato allo stesso perimetro HR privato di Ferie/104.
- Navigazione laterale e command menu.
- Export e restore backup v1.
- Helper date-only testabili.
- Test unitari e API mirati.

## Schema locale

Migration creata:

- `supabase/migrations/00034_personal_deadlines.sql`

Campi principali:

- `user_id`
- `title`
- `description`
- `category`
- `due_date`
- `status`
- `priority`
- `recurrence`
- `reminder_days_before`
- `completed_at`
- `created_at`
- `updated_at`

Categorie supportate:

- `VEHICLE`
- `DOCUMENT`
- `HEALTH`
- `FAMILY`
- `SCHOOL`
- `SUBSCRIPTION`
- `ADMINISTRATIVE`
- `OTHER`

Stati supportati:

- `ACTIVE`
- `COMPLETED`
- `CANCELLED`

Ricorrenza supportata come metadato:

- `NONE`
- `MONTHLY`
- `YEARLY`

## Sicurezza

- La pagina `/deadlines` usa controllo server-side e `notFound()` per utenti non autorizzati.
- Le API richiedono sessione valida.
- Le API richiedono accesso HR privato.
- Ogni query filtra sempre per `user_id`.
- PATCH e DELETE operano solo su record dell'utente corrente.
- Il client non puo' elevare privilegi tramite payload.
- Il restore ricostruisce sempre `user_id` dal contesto autenticato.
- Non viene usato service role nel browser.

## Backup e restore

Export:

- `personalDeadlines` viene incluso solo per account HR privato autorizzato.
- `user_id` non viene esportato nel backup.
- I record count includono `personalDeadlines`.

Restore:

- Un backup che contiene scadenze private viene bloccato per account non autorizzati.
- Per account autorizzato, le scadenze vengono ripristinate dopo la RPC contabile principale.
- Il ripristino delle scadenze non modifica dati contabili.

## UI

La pagina mostra:

- riepilogo scadute, oggi, prossimi 30 giorni e totale attive;
- filtri per stato temporale e categoria;
- lista ordinata per urgenza;
- dialog di creazione e modifica;
- azioni completa, riapri, modifica, elimina;
- empty state e loading state.

## Test creati

- `tests/unit/deadlines/deadlines.test.ts`
- `tests/api/deadlines-route.test.ts`

Test backup aggiornati:

- `tests/api/backup-export-route.test.ts`
- `tests/api/backup-restore-route.test.ts`

Casi coperti:

- classificazione scaduta/oggi/prossima/futura;
- esclusione completate e cancellate dalle attive;
- promemoria date-only;
- sorting;
- KPI prossimi 30 giorni;
- API 401/403;
- validazione input;
- ownership su create/update/delete;
- completamento e riapertura;
- export privato autorizzato;
- restore privato autorizzato;
- blocco restore privato non autorizzato.

## Limiti residui

- La ricorrenza e' un metadato: non genera automaticamente nuove scadenze future.
- Non sono state aggiunte notifiche push o email.
- Non e' stata applicata alcuna migration remota.
- Non sono stati modificati dati reali.

## Verifiche richieste

Risultati eseguiti a fine sprint:

- `git status`: presenti solo modifiche dello Sprint 34, nessun commit eseguito.
- `npx tsc --noEmit`: PASS.
- `npx vitest run tests/unit/deadlines/deadlines.test.ts tests/api/deadlines-route.test.ts tests/api/backup-export-route.test.ts tests/api/backup-restore-route.test.ts`: PASS, 4 file, 39 test.
- `npx vitest run`: timeout dopo 420 secondi senza indicare file/test avviato.
- `npm run test:coverage`: timeout dopo 420 secondi senza indicare file/test avviato.
- `npx vitest run --coverage tests/unit/deadlines/deadlines.test.ts tests/api/deadlines-route.test.ts tests/api/backup-export-route.test.ts tests/api/backup-restore-route.test.ts`: 39 test PASS, comando fallito solo per soglie globali applicate all'intero repository filtrato.
- `npm run build`: PASS.
- `git diff --check`: PASS.

## Conferme

- Nessuna modifica alla logica contabile.
- Nessuna nuova transazione creata.
- Nessun saldo modificato.
- Nessun provider AI coinvolto.
- Nessun commit.
- Nessun push.
- Nessun deploy.
- Nessuna migration remota applicata.
