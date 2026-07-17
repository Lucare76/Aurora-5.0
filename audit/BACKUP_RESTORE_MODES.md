# Backup Restore Modes

## Modalita A - Ripristino su account vuoto

Ricostruisce completamente i dati applicativi dell'utente autenticato solo se non esistono dati utente rilevanti.

Vantaggi:

- piu' sicura;
- meno collisioni;
- puo' conservare ID originali;
- ideale come prima implementazione reale.

Rischi:

- deve definire cosa significa "vuoto";
- profilo esiste sempre o quasi sempre;
- deve bloccare se trova conti/transazioni/categorie non default.

## Modalita B - Sostituzione completa

Elimina o archivia i dati correnti e ripristina il backup.

Rischio: alto.

Requisiti minimi:

- backup automatico immediatamente prima;
- transazione o sessione restore tracciata;
- conferma testuale;
- dry-run obbligatorio;
- rollback provato.

Non consigliata per prima release.

## Modalita C - Unione/Merge

Aggiunge dati mancanti mantenendo quelli presenti.

Rischio: alto.

Problemi:

- duplicati interni/esterni;
- collisioni UUID;
- categorie simili;
- conti con stesso nome;
- movimenti identici;
- trasferimenti doppi;
- saldi da non sommare impropriamente.

Non consigliata per prima release.

## Modalita D - Simulazione/Dry-run

Non scrive nulla. Produce:

- record validi;
- record invalidi;
- collisioni;
- duplicati;
- riferimenti mancanti;
- record che verrebbero creati;
- record che verrebbero aggiornati;
- record ignorati;
- variazione prevista dei saldi e patrimonio;
- warnings privacy/versione.

## Raccomandazione

Implementare per prime:

1. **Dry-run obbligatorio**.
2. **Restore su account vuoto**.

Rimandare:

- merge;
- sostituzione completa;
- restore parziale per singola tabella;
- restore cross-user non amministrativo.
