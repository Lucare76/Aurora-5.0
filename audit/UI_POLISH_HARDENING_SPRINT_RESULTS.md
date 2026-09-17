# Aurora 5.0 — UI Polish & Hardening Sprint

## Obiettivo

Sprint mirato e a basso rischio dopo la chiusura della riconciliazione bancaria. Nessuna modifica a schema database, migration, saldi, report finanziari o regole contabili.

Focus:

- chiudere incoerenze UX residue emerse dal precedente quality audit;
- migliorare accessibilità e feedback d'errore nelle aree Scenari e Avvisi;
- eliminare una fragilità reale del build Next.js nella route cron notifiche;
- non cambiare comportamento economico o dati utente.

## Audit sintetico

### Budget

La pagina Budget è già più avanti rispetto al precedente audit: ha microcopy esplicativa, layout responsive, empty state, riepilogo mensile, forecast e messaggi di errore via toast. In questo pass non è stata modificata per evitare churn non necessario su una pagina ampia e finanziariamente sensibile.

Resta una incoerenza visuale non bloccante: alcuni badge di stato Budget sono ancora locali anziché usare `StatusBadge`. È candidata a un pass visuale dedicato con verifica browser.

### Scenari

Problemi trovati:

- badge di stato locale e non allineato a `StatusBadge`;
- bottoni icona affidati soprattutto a `title`;
- tab filtro senza semantica `tablist/tab`;
- delete non verificava `res.ok` prima di aggiornare ottimisticamente la UI;
- microcopy iniziale poco esplicita sul fatto che una simulazione non modifica dati reali.

Correzioni:

- `StatusBadge` condiviso per Pronto / Bozza / Da aggiornare / Archiviato;
- `aria-label` e focus ring sui bottoni icona;
- semantica tab accessibile;
- loading state con `role=status` / `aria-live`;
- verifica `res.ok` su delete;
- microcopy più chiara su natura simulativa e side-effect free.

### Avvisi

Problemi trovati:

- il caricamento ignorava silenziosamente errori HTTP/rete;
- molte azioni mutative non controllavano `res.ok`, quindi la UI poteva aggiornarsi anche dopo un fallimento server;
- feedback utente non uniforme su archive / restore / resolve / snooze / mute;
- tab e paginazione migliorabili sul piano semantico/accessibile.

Correzioni:

- stato errore esplicito con retry;
- helper centrale `postAction` che fallisce su HTTP non-2xx;
- toast success/error coerenti;
- tablist/tab con `aria-selected`;
- paginazione con `nav` e label;
- loading state e conteggio con `aria-live`;
- dialog mute con `aria-labelledby` e cancellazione disabilitata durante l'azione.

### Cron `/api/notifications/daily-check`

Problema reale confermato durante il precedente deploy:

- `createAdminClient()` e `new Resend(...)` venivano eseguiti a livello modulo;
- Next.js importava la route durante build/page-data collection;
- env mancanti in Preview/locale facevano fallire l'intero `next build`, anche senza invocare il cron.

Correzione:

- inizializzazione Supabase admin e Resend spostata dentro `GET`;
- `CRON_SECRET` verificato esplicitamente prima dell'autenticazione;
- env runtime mancanti producono risposta `503` della sola route anziché crash del build;
- il controllo bearer `CRON_SECRET` resta obbligatorio;
- nessuna modifica alla logica ricorrenze, compleanni o reminder.

## File modificati

- `src/app/(app)/scenarios/page.tsx`
- `src/app/(app)/notifications/page.tsx`
- `src/app/api/notifications/daily-check/route.ts`

## Rischio

Basso-medio.

- Nessuna migration.
- Nessuna modifica alla persistenza finanziaria.
- Nessun algoritmo economico cambiato.
- La route cron mantiene lo stesso contratto funzionale ma inizializza i client solo a runtime.
- Gli interventi UI sono prevalentemente semantici, accessibilità e gestione errori.

## Verifiche ancora richieste

Le modifiche sono state effettuate direttamente tramite GitHub, quindi in questo ambiente non è stata eseguita la suite locale completa.

Prima del merge eseguire sul branch:

```bash
npx tsc --noEmit
npx vitest run
npm run test:coverage
npm run build
git diff --check
```

Eseguire inoltre uno smoke test browser su Preview per:

1. Scenari: filtri, preferito, archivia, elimina, apertura dettaglio.
2. Avvisi: caricamento, refresh, mark read, archive/restore/resolve, snooze/unsnooze, mute.
3. Build Preview senza dipendere dall'inizializzazione top-level della route `daily-check`.

## Stato branch

Branch dedicato: `feat/ui-polish-hardening`.

Non fare merge su `main` finché i check sopra non sono verdi.
