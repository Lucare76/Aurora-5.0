# Backup Validation Plan

## Pipeline

1. Lettura file in memoria con dimensione massima.
2. Parse JSON.
3. Verifica `format`.
4. Verifica `schemaVersion`.
5. Validazione schema.
6. Validazione record.
7. Validazione relazioni.
8. Validazione integrita' contabile.
9. Dry-run piano scrittura.
10. Report errori/warning.

## Libreria consigliata

Il progetto usa gia' `zod`. Usare Zod per validazione pura del backup senza installare nuove dipendenze.

## Controlli bloccanti

- JSON non valido.
- `format` diverso da `aurora-backup`.
- `schemaVersion` non supportata.
- Campi obbligatori mancanti.
- Tipi errati.
- Enum non validi.
- Date invalide.
- Importi non numerici, NaN, infiniti o negativi dove non ammessi.
- UUID invalidi.
- FK mancanti: account/category/loan/birthday.
- `parent_id` orfano.
- `transfer_peer_id` non risolvibile.
- Duplicati interni di ID.
- Record counts non corrispondenti.
- Checksum non corrispondente.
- File oltre dimensione massima.
- Dati con ownership incompatibile se si decide di validare exportedBy.

## Warning

- Campi sconosciuti.
- Versione app esportatrice piu' vecchia.
- Audit logs assenti.
- Birthday reminder log assente.
- Receipt URL esterni.
- Saldo snapshot diverso da saldo derivabile.
- Categorie duplicate per nome/tipo.
- Conti con stesso nome di conti esistenti.

## Informazioni

- Conteggio record per tabella.
- Intervallo date transazioni.
- Valuta principale.
- Numero trasferimenti.
- Numero record opzionali assenti.

## Record recuperabili

Solo in dry-run, non in restore automatico iniziale:

- audit logs con record_id mancante;
- reminder log vecchi;
- categorie senza colore/icon;
- note vuote.

## Record da rifiutare

- transazioni senza account valido;
- budget senza categoria valida;
- loan_payment senza loan;
- trasferimenti orfani;
- categorie figlie con parent_id assente;
- record con importi invalidi.

## Protezioni

- Max file size iniziale raccomandata: 25 MB.
- Max record per sezione configurabile.
- Timeout parsing/validazione.
- Nessun log di descrizioni, note o importi dettagliati.
