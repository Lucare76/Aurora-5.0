# Backup Restore Order

## Ordine raccomandato

1. Validazione completa file.
2. Creazione sessione restore in memoria o tabella futura.
3. Profilo/impostazioni.
4. Account.
5. Categorie padre.
6. Sottocategorie.
7. Transazioni non-transfer.
8. Trasferimenti one-row.
9. Trasferimenti legacy two-row.
10. Budget.
11. Ricorrenze.
12. Prestiti.
13. Pagamenti prestiti.
14. Compleanni.
15. Birthday reminder log.
16. Audit log, se incluso.
17. Verifiche finali.

## Categorie

Ripristinare prima categorie con `parent_id = null`, poi figli. In modalita mapping, creare tutti gli ID mapping prima della scrittura.

## Transazioni

Separare:

- non-transfer;
- transfer con destination account;
- transfer legacy con peer transaction.

I trasferimenti legacy richiedono validazione della coppia e possibile seconda fase per collegare `transfer_peer_id`.

## Saldi

Non ricalcolare saldi tramite chiamate incrementali se il restore inserisce transazioni storiche. Per restore account vuoto:

- inserire account con saldo snapshot;
- inserire transazioni;
- verificare saldo snapshot contro saldo atteso/logico;
- se differisce, bloccare o richiedere conferma motivata.

## Transazionalita'

Ideale: restore in una singola transazione DB lato server. Se non sostenibile:

- batch atomici;
- sessione restore;
- lista record creati;
- compensazione in ordine inverso;
- backup automatico prima.

## Rollback order

1. Audit logs restore.
2. Reminder logs.
3. Birthdays.
4. Loan payments.
5. Loans.
6. Recurring rules.
7. Budgets.
8. Transactions.
9. Categories children.
10. Categories parents.
11. Accounts.
12. Profile changes.
