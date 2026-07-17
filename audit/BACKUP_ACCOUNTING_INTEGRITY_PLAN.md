# Backup Accounting Integrity Plan

## Principio

Tolleranza zero per differenze contabili non motivate. Il restore deve preservare saldi, patrimonio, trasferimenti e aggregati.

## Prima del restore

Calcolare dal backup:

- record counts;
- somma entrate;
- somma uscite;
- netto;
- saldi snapshot per conto;
- patrimonio totale;
- trasferimenti one-row;
- trasferimenti legacy;
- record orfani;
- spese per mese;
- entrate per mese;
- budget per categoria/mese.

## Durante dry-run

Produrre:

- mapping ID previsto;
- collisioni;
- record ignorati;
- record creati;
- record aggiornati;
- variazione saldo per conto;
- patrimonio previsto;
- differenza tra saldo snapshot e saldo derivato;
- trasferimenti neutrali/non neutrali.

## Dopo restore

Verificare:

- conteggi record effettivi;
- saldo di ogni conto;
- patrimonio totale;
- entrate/uscite per mese;
- report mensili;
- budget speso;
- prestiti remaining vs loan_payments;
- trasferimenti neutrali;
- export nuovo equivalente al backup logico;
- checksum logico.

## Checksum logico

Calcolare hash canonicalizzato su record ordinati per tabella/id, escludendo:

- user_id rimappato;
- created_at/updated_at se rigenerati;
- campi non deterministici.

## Trasferimenti

Regole:

- Transfer one-row: source -amount, destination +amount, patrimonio invariato.
- Legacy pair: expense e income accoppiate, patrimonio invariato.
- Orfani: errore bloccante.
- Ambigui: errore bloccante.

## Differenze ammesse

Solo differenze esplicitamente dichiarate:

- user_id sostituito con utente corrente;
- timestamps di restore;
- audit log non ripristinato se escluso dalla modalita.
