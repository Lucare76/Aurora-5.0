# Backup Test Strategy

## Unit test

- Parser JSON.
- Schema validation con Zod.
- Versioning e migrazione formato.
- Canonicalizzazione checksum.
- Record counts.
- ID mapping.
- Ordinamento dipendenze.
- Duplicate detection.
- Classificazione trasferimenti.
- Verifica saldi/patrimonio.
- Error/warning classification.

## Integration test

- Restore dry-run su DB locale/clone.
- Restore su account vuoto.
- RLS e ownership.
- User_id del file ignorato.
- Rollback su errore.
- Categorie padre/figlio.
- Trasferimenti one-row.
- Trasferimenti legacy two-row.
- Budget.
- Ricorrenze.
- Prestiti e loan_payments.
- Compleanni e reminder log.

## End-to-end

- Upload file valido.
- Upload file non JSON.
- Versione non supportata.
- Anteprima.
- Dry-run.
- Conferma.
- Successo.
- Errore.
- Interruzione rete/browser.
- Doppio invio.

## Fixture richieste

- Backup minimo.
- Backup completo.
- Backup corrotto.
- Versione vecchia.
- Versione futura.
- FK mancante.
- Parent category mancante.
- Trasferimento orfano.
- UUID duplicato.
- Importi decimali.
- Storico pluriennale.
- File molto grande.
- Backup con receipt metadata.
- Backup con audit logs.

## Criteri di accettazione test

- Nessun test usa produzione.
- Integration solo con `SUPABASE_TEST_*`.
- Ogni restore test verifica conteggi, saldi, patrimonio e checksum logico.
- Ogni errore critico blocca scritture.
