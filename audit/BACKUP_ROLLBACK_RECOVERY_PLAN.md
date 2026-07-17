# Backup Rollback and Recovery Plan

## Principio

Ogni restore futuro deve essere reversibile o atomico. Nessuna modalita' deve lasciare dati parziali senza report e piano di recupero.

## Prima del restore

- Eseguire backup automatico dello stato corrente.
- Generare `restoreSessionId`.
- Salvare piano dry-run.
- Bloccare doppio invio.
- Mostrare riepilogo prima/dopo.

## Durante restore

Opzione preferita:

- transazione unica lato server.

Fallback:

- batch atomici;
- traccia record creati/aggiornati;
- compensazione in ordine inverso;
- stato sessione: pending/running/failed/rolled_back/completed.

## Se il browser viene chiuso

Il restore non deve dipendere dal browser. Se server-side:

- sessione continua o fallisce in modo tracciato;
- al nuovo accesso mostra stato e report.

## Se cade la rete

- Non ritentare automaticamente scritture non idempotenti.
- L'utente deve poter consultare sessione restore.
- Ogni batch deve essere idempotente tramite sessionId.

## Se una tabella fallisce

- Transazione unica: rollback automatico.
- Batch: interrompere, compensare record creati, produrre report.

## Se file incompleto o timeout

- Bloccare prima delle scritture se validazione non termina.
- Timeout durante scrittura: sessione failed, rollback/compensazione.

## Se meta' batch e' applicata

- Usare restoreSessionId per identificare record creati.
- Eliminare in ordine inverso.
- Se impossibile, bloccare ulteriori restore e chiedere intervento manuale.

## Se utente ripete restore

- Dry-run deve rilevare collisioni/duplicati.
- Doppio submit della stessa sessione deve essere no-op o errore gestito.

## Report finale

Deve includere:

- sessionId;
- modalita;
- record creati/aggiornati/ignorati;
- errori;
- rollback eseguito o non necessario;
- checksum post-restore.
