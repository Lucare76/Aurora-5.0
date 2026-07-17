# Backup Restore UX Flow

## Flusso futuro consigliato

1. Selezione file.
2. Lettura locale.
3. Validazione struttura.
4. Riepilogo contenuto.
5. Warning privacy.
6. Scelta modalita.
7. Dry-run obbligatorio.
8. Confronto prima/dopo.
9. Conferma testuale.
10. Backup automatico dello stato corrente.
11. Restore.
12. Verifica finale.
13. Report scaricabile.

## Copy consigliati

### File non valido

"Il file non e' un backup Aurora valido. Nessun dato e' stato modificato."

### Versione non supportata

"Questo backup usa una versione non supportata. Puoi conservarlo, ma Aurora non puo' ripristinarlo in sicurezza."

### Collisioni

"Abbiamo trovato record che entrerebbero in conflitto con dati gia' presenti. Esegui il ripristino su un account vuoto o usa una modalita di merge quando sara' disponibile."

### Record ignorati

"Alcuni record non verrebbero importati perche' incompleti o non collegati correttamente. Controlla il report prima di continuare."

### Dry-run completato

"Simulazione completata. Nessun dato e' stato scritto. Controlla conteggi, saldi e avvisi prima di confermare."

### Restore completato

"Ripristino completato e verificato. Saldi, patrimonio e conteggi corrispondono al backup."

### Restore fallito

"Ripristino interrotto. Nessun dato e' stato modificato oppure e' stato eseguito il rollback. Scarica il report per i dettagli."

### Rollback eseguito

"Rollback completato. Aurora e' tornata allo stato precedente al ripristino."

## Conferme

Evitare "Sei sicuro?".

Usare conferme esplicite:

- Per account vuoto: scrivere `RIPRISTINA`.
- Per sostituzione completa futura: scrivere `SOSTITUISCI I MIEI DATI`.
- Per merge futuro: scrivere `UNISCI DATI`.

## Riepilogo contenuto

Mostrare:

- data backup;
- versione;
- record counts;
- conti;
- transazioni;
- periodo storico;
- patrimonio snapshot;
- warning.

## UX minima prima release

Solo:

- upload;
- validazione;
- dry-run;
- restore su account vuoto;
- report finale.
