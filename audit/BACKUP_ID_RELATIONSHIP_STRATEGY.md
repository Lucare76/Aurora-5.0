# Backup ID and Relationship Strategy

## Problema

Il restore deve ricostruire relazioni tra account, categorie, transazioni, trasferimenti, budget, ricorrenze, prestiti e pagamenti senza fidarsi dello `user_id` del file e senza corrompere dati gia' presenti.

## Strategia 1 - Conservare ID originali

Descrizione: inserire i record con gli stessi UUID del backup.

Vantaggi:

- restore su account vuoto semplice;
- relazioni preservate senza mapping;
- ottimo per disaster recovery completo.

Svantaggi:

- collisioni probabili su account non vuoto;
- merge rischioso;
- impossibile fidarsi di `user_id`;
- conflitti con record esistenti possono bloccare tutto.

Compatibilita':

- Account vuoto: alta.
- Merge: bassa.
- Trasferimenti peer: buona se tutti i record sono presenti.
- Rollback: semplice se sessione traccia gli ID.

## Strategia 2 - Generare nuovi ID con mapping

Descrizione: ogni record riceve un nuovo UUID; il restore mantiene una tabella in memoria `oldId -> newId`.

Vantaggi:

- sicura per merge;
- evita collisioni;
- permette restore cross-account controllato;
- forza ownership corrente.

Svantaggi:

- complessita' alta;
- transfer_peer_id e parent_id devono essere rimappati con attenzione;
- audit storico perde ID originali come chiave primaria.

Compatibilita':

- Account vuoto: alta, ma piu' complessa.
- Merge: alta.
- Trasferimenti peer/circolari: richiede due passaggi.
- Rollback: serve session log dei nuovi ID.

## Strategia 3 - Ibrida

Descrizione: conservare ID originali solo in modalita account vuoto; usare mapping per merge o collisioni. Conservare sempre `original_id` nel report/sessione restore, non necessariamente nel DB.

Vantaggi:

- ottimale per restore pulito;
- sicura per scenari non vuoti;
- riduce complessita' iniziale;
- permette evoluzione futura.

Svantaggi:

- richiede due percorsi testati;
- bisogna dichiarare chiaramente la modalita scelta.

## Raccomandazione

Adottare strategia ibrida:

1. **Backup Sprint iniziali**: restore su account vuoto conservando ID originali, dopo validazione che l'utente non abbia dati applicativi.
2. **Merge futuro**: usare nuovi ID con mapping esplicito.
3. Non fidarsi mai di `user_id` del backup: sostituirlo con `auth.uid()`.

## Relazioni specifiche

- `account_id`: mappa account prima delle transazioni.
- `category_id`: mappa categorie padre e figli prima delle transazioni.
- `parent_id`: richiede restore categorie in due livelli o mapping completo preliminare.
- `transfer_peer_id`: puo' riferire account destination o peer transaction legacy; classificare prima.
- Budget: dipende da categoria.
- Ricorrenze: dipendono da account e categoria.
- Prestiti: indipendenti, ma loan_payments dipendono da loans.
- Audit log: se ripristinato, record_id potrebbe diventare storico non operativo.

## Collisioni

- Account vuoto: collisione ID e' errore bloccante.
- Merge: collisione ID genera nuovo ID e mapping, salvo record identico verificato via hash.

## Riferimenti circolari

Trasferimenti legacy two-row possono avere riferimento reciproco. Validare entrambi i record prima, inserire senza link se tecnicamente necessario, poi aggiornare link in transazione unica.
