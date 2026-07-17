# Backup Gap Analysis - Aurora 5.0

## Sintesi

Il backup JSON attuale contiene la maggior parte dei dati operativi, ma manca una struttura versionata e mancano entita' importanti per ricostruzione completa e verificabile.

Completezza stimata: **70%**.

## Matrice gap

| ID | Elemento | Stato | Severita' | Motivo |
|---|---|---|---|---|
| G-01 | Accounts | Completo | P1 | Campi inclusi, ma restore saldo richiede verifica contabile. |
| G-02 | Categories/sottocategorie | Completo | P1 | Inclusi, ma serve ordine padre/figlio e validazione parent_id. |
| G-03 | Transactions | Parziale/rischioso | P1 | Incluse, ma transfer_peer_id sovraccarico e restore richiede gestione dedicata. |
| G-04 | Budgets | Completo | P2 | Inclusi, dipendono da categorie. |
| G-05 | Recurring rules | Completo | P2 | Incluse, ma restore deve evitare auto-creazioni duplicate. |
| G-06 | Loans | Completo | P2 | Inclusi, ma coerenza con loan_payments va verificata. |
| G-07 | Loan payments | Completo | P2 | Inclusi, dipendono da loans. |
| G-08 | Birthdays | Completo | P3 | Inclusi. |
| G-09 | Profiles/settings | Assente | P1 | Valuta, timezone, locale e display_name non ripristinati. |
| G-10 | Birthday reminder log | Assente | P3 | Si possono rigenerare in parte, ma rischio notifiche ripetute. |
| G-11 | Audit logs | Assente | P3 | Non blocca contabilita', ma perde storico azioni. |
| G-12 | Auth user | Assente/da escludere | P3 | Non deve essere fidato dal backup; restore usa utente autenticato. |
| G-13 | Receipt files/storage | Ambiguo | P2 | URL/data inclusi solo se in transaction; file esterni non garantiti. |
| G-14 | Checksum | Assente | P1 | Non si rilevano file corrotti/manomessi. |
| G-15 | Record counts | Assente | P2 | Difficile validare completezza. |
| G-16 | schemaVersion | Assente | P1 | `version: 5.0` non basta a migrare formato backup. |
| G-17 | Restore order | Assente | P0 | Senza ordine e transazione il restore automatico e' rischioso/impossibile. |
| G-18 | ID collision strategy | Assente | P0 | Merge o restore su account non vuoto puo' duplicare/corrompere relazioni. |
| G-19 | Dry-run | Assente | P1 | Non si puo' prevedere impatto prima di scrivere. |
| G-20 | Rollback | Assente | P0 | Un restore parziale non avrebbe recupero sicuro. |

## Conteggio gap

- P0: 3
- P1: 7
- P2: 5
- P3: 5

## Dati mancanti piu' importanti

1. Profilo/impostazioni.
2. Checksum e record counts.
3. Strategia ID e mapping.
4. Restore order.
5. Rollback/dry-run.

## Conclusione

Il backup attuale puo' supportare recupero manuale, ma non e' sufficiente per restore automatico affidabile. Il rischio maggiore non e' il dump dati: e' il ripristino senza validazione, mapping ID e rollback.
