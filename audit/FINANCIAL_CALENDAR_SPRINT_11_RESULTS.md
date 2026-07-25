# Sprint 11 - Calendario Finanziario e Saldo Previsionale

## Architettura

Lo sprint introduce una nuova area centralizzata:

- `src/lib/financial-calendar/types.ts`: contratto dati, enum derivati, payload API ed errori applicativi.
- `src/lib/financial-calendar/calculations.ts`: generazione eventi, ricorrenze, saldo previsionale, criticita', agenda, insight.
- `src/lib/financial-calendar/service.ts`: validazione URL, query Supabase, ownership e composizione payload.
- `src/app/api/financial-calendar/route.ts`: endpoint autenticato.
- `src/app/(app)/calendar/page.tsx`: UI calendario/agenda con una sola fetch client.

La pagina non esegue query Supabase dirette.

## Percorso Pagina

Percorso scelto: `/calendar`.

Motivo: e' breve, coerente con le rotte applicative esistenti (`/reports`, `/budgets`, `/goals`) e leggibile nella navigazione.

## Fonti Evento

Gli eventi vengono generati da:

- ricorrenze attive;
- prestiti aperti con `due_date`;
- obiettivi attivi con `target_date`;
- budget mensili;
- movimenti reali nel periodo.

Non vengono creati movimenti reali.

## Eventi Unificati

Ogni evento usa il tipo `FinancialCalendarEvent` con:

- fonte;
- tipo evento;
- data;
- importo;
- direzione;
- conto;
- categoria;
- stato;
- affidabilita';
- link origine.

Gli stati sono derivati e non vengono salvati nel database.

## Ricorrenze

Supportate:

- giornaliera;
- settimanale;
- bisettimanale;
- mensile;
- trimestrale;
- annuale.

Le ricorrenze sospese non vengono generate. Le ricorrenze con `end_date` rispettano la data finale.

Regola mesi corti: se il giorno non esiste nel mese target, viene usato l'ultimo giorno del mese. Questa scelta e' documentata per evitare una seconda interpretazione implicita.

## Prestiti

Il modulo prestiti non dispone di un piano rateale affidabile. Per questo lo sprint genera solo la scadenza generale del prestito:

- prestito dato: rientro previsto;
- prestito ricevuto: uscita prevista.

Non vengono inventate rate.

## Budget

Per ogni budget nel periodo viene creato un evento informativo di chiusura a fine mese, con residuo o superamento calcolato sui movimenti reali disponibili nel mese.

## Obiettivi

Per ogni obiettivo attivo con `target_date` viene creato un evento informativo. Se manca ancora capitale, l'evento segnala l'importo residuo.

## Transazioni Reali

I movimenti reali del periodo sono visualizzabili come eventi `COMPLETED`. Sono distinguibili dagli eventi previsionali e non alterano il saldo previsto.

Limite: se una ricorrenza non e' collegata in modo affidabile a una transazione tramite `recurring_id`, gli eventi restano separati.

## Saldo Previsionale

Base temporale:

- parte dai saldi correnti dei conti attivi;
- include solo eventi previsionali da oggi/periodo in avanti;
- non ricostruisce saldi storici per mesi passati;
- i movimenti reali sono informativi.

Formula:

```text
saldo previsto = saldo corrente + entrate previste - uscite previste
```

Gli eventi `NEUTRAL` non modificano il cash flow.

## Trasferimenti

I trasferimenti reali sono informativi nella vista calendario. Non vengono sommati nel cash flow del saldo previsionale totale.

## Soglia

La soglia e' locale via URL (`threshold`) e default `0`. Non e' stata introdotta una preferenza persistente per evitare migration.

## Criticita'

Vengono rilevati:

- saldo sotto zero;
- saldo sotto soglia;
- uscita elevata;
- piu' scadenze di uscita nello stesso giorno;
- prestito scaduto;
- obiettivo con importo residuo;
- evento senza conto.

## Affidabilita'

La previsione restituisce:

- `forecastConfidence`;
- motivazioni;
- completezza percentuale;
- eventi senza conto;
- eventi senza importo.

## Calendario

La vista mensile mostra:

- giorno;
- saldo previsto a fine giornata;
- massimo 3 eventi;
- indicatori di criticita';
- dettaglio giorno selezionato.

La settimana parte da lunedi'.

## Agenda

La vista agenda raggruppa:

- Oggi;
- Domani;
- Questa settimana;
- Prossima settimana;
- Piu' avanti.

Gli eventi sono ordinati per: reali, entrate, neutri, uscite.

## Grafico

Grafico `Saldo previsto` con Recharts:

- saldo totale previsto;
- linea soglia;
- tooltip con formato valuta;
- descrizione accessibile.

## Filtri

Parametri URL:

- `view`;
- `month`;
- `from`;
- `to`;
- `range`;
- `account`;
- `category`;
- `sourceType`;
- `direction`;
- `status`;
- `includeActual`;
- `includeExpected`;
- `includeInformational`;
- `threshold`.

Limite previsione: massimo 24 mesi.

## API

Endpoint:

```http
GET /api/financial-calendar
```

Header:

```http
Cache-Control: no-store
```

Errori:

- `UNAUTHORIZED`
- `INVALID_MONTH`
- `INVALID_DATE`
- `INVALID_RANGE`
- `RANGE_TOO_LARGE`
- `INVALID_ACCOUNT`
- `INVALID_CATEGORY`
- `INVALID_THRESHOLD`
- `CALENDAR_FAILED`

## Ricerca Globale

Aggiunti al command menu:

- Calendario;
- Vai a oggi;
- Prossimi 30 giorni.

## Stampa

La pagina include `Stampa calendario` con CSS print. In stampa vengono nascosti navigazione, filtri e pulsanti.

## Sicurezza

- Endpoint autenticato.
- Query con client server e RLS.
- Filtro esplicito per `user_id`.
- Verifica ownership per conto e categoria.
- Nessun service role.
- Errori Supabase non esposti.

## Timezone

La timezone viene letta da `profiles.timezone`; fallback `Europe/Rome`.

Le date sono trattate come date-only (`YYYY-MM-DD`) per evitare shift UTC.

## Performance

- 8 query parallele.
- Select esplicite.
- Nessun N+1.
- Nessuna query per giorno, ricorrenza o rata.
- Generazione eventi in memoria su orizzonte limitato.
- Limite massimo: 1.000 eventi per risposta.
- Una sola fetch client con `AbortController`.

## Test

Creati:

- `tests/unit/financial-calendar/calculations.test.ts`
- `tests/api/financial-calendar-route.test.ts`

Casi coperti:

- ricorrenze giornaliere, settimanali, mensili, annuali;
- fine ricorrenza;
- ricorrenza sospesa;
- mese corto;
- prestito futuro;
- obiettivo in scadenza;
- budget;
- saldo previsionale;
- eventi neutri;
- soglia;
- criticita';
- affidabilita';
- agenda;
- insight;
- autenticazione API;
- ownership;
- no-store;
- parametri invalidi;
- errori database mascherati.

## Migration

Nessuna migration creata.

## Limiti Noti

- Non esiste un piano rateale dei prestiti: viene mostrata solo la scadenza generale.
- Gli eventi manuali previsionali sono rinviati.
- Le transazioni reali non vengono deduplicate con una ricorrenza se manca un collegamento affidabile.
- Test manuali browser non eseguiti in questa fase.

## Funzionalita' Rinviate

Sprint 11B consigliato:

- eventi previsionali manuali;
- conversione evento previsto in transazione;
- preferenza persistente di soglia saldo;
- dettaglio evento dedicato.
