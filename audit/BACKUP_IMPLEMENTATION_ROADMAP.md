# Backup Implementation Roadmap

## Backup Sprint 2 - Formato versionato e validatore puro

Obiettivo: definire tipi, Zod schema, canonical checksum e validatore.

File/aree: nuova area domain backup, test unitari, fixture statiche.

Test: parser, schema, checksum, record counts, versioning.

Rischio: basso.

Durata: 4-6 ore.

Criteri: validatore puro senza Supabase e senza UI.

Dipendenze: questo audit.

## Backup Sprint 3 - Nuovo backup completo v1

Obiettivo: generare backup `aurora-backup` v1 includendo profile e integrita.

File/aree: Impostazioni export, domain backup.

Test: snapshot formato, record counts, no dati mancanti.

Rischio: medio.

Durata: 4-6 ore.

Criteri: export v1 validato dal parser; export vecchio non rimosso finche' non deciso.

## Backup Sprint 4 - Dry-run restore senza scrittura

Obiettivo: caricare backup e produrre piano restore senza DB writes.

File/aree: domain backup restore planner, eventuale pagina impostazioni solo preview.

Test: collisioni, FK, mapping, saldi previsti.

Rischio: medio.

Durata: 6 ore.

Criteri: nessuna scrittura, report completo.

## Backup Sprint 5 - Restore su account vuoto in ambiente isolato

Obiettivo: implementare restore solo su account vuoto, dietro validazione.

File/aree: RPC/API futura o server action, test integration locale/clone.

Test: RLS, ownership, rollback, trasferimenti, categorie, prestiti.

Rischio: alto.

Durata: 1-2 giorni.

Criteri: test integration verdi su DB isolato; nessun merge.

## Backup Sprint 6 - UI controllata

Obiettivo: esporre flusso utente con upload, dry-run, conferma, restore e report.

File/aree: Impostazioni/Dati.

Test: componenti UI, e2e smoke se disponibile.

Rischio: medio.

Durata: 4-6 ore.

Criteri: dry-run obbligatorio; conferma testuale; report scaricabile.

## Backup Sprint 7 - Sostituzione completa e merge

Obiettivo: valutare modalita avanzate solo dopo stabilizzazione.

Rischio: alto.

Durata: da stimare dopo Sprint 5.

Criteri: rollback provato e test su fixture grandi.
