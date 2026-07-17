# Backup Data Inventory - Aurora 5.0

## Scopo

Inventario delle entita' necessarie per ricostruire Aurora 5.0 da un backup. Basato su `src/types/database.ts`, migration Supabase e flussi UI attuali.

## Entita' principali

| Entita' | Tabella/origine | PK | Ownership | FK/dipendenze | Obbligatori | Opzionali | Calcolati/ricostruibili | Deve stare nel backup | Ordine restore |
|---|---|---|---|---|---|---|---|---|---|
| Profilo | `profiles` | `id` | `id = auth.users.id` | auth user | id, currency, locale, timezone, onboarding_done | display_name, avatar_url | no | Si | 1 |
| Conti | `accounts` | `id` | `user_id` | auth user | user_id, name, type, balance, currency, is_active, is_hidden, sort_order | color, icon | saldo teorico ricostruibile ma saldo snapshot va preservato | Si | 2 |
| Categorie padre | `categories` | `id` | `user_id` | auth user | user_id, name, type, is_default, sort_order | color, icon | no | Si | 3 |
| Sottocategorie | `categories` | `id` | `user_id` | `parent_id -> categories.id` | come categorie | parent_id | no | Si | 4 |
| Transazioni | `transactions` | `id` | `user_id` | account_id, category_id, recurring_id | user_id, account_id, type, amount, date | description, notes, receipt_url, receipt_data, transfer_peer_id | report/aggregati ricostruibili | Si | 5/6 |
| Trasferimenti one-row | `transactions` | `id` | `user_id` | `account_id`, `transfer_peer_id` come destination account | type=transfer, amount, date, source/dest | description, notes | neutralita' ricostruibile | Si | 6 |
| Trasferimenti legacy two-row | `transactions` | `id` | `user_id` | `transfer_peer_id -> transactions.id` logico | income+expense accoppiate | description | neutralita' ricostruibile | Si | 6 |
| Budget | `budgets` | `id` | `user_id` | category_id | user_id, category_id, amount, month, year | timestamps | speso ricostruibile da transazioni | Si | 7 |
| Ricorrenze | `recurring_rules` | `id` | `user_id` | account_id, category_id | account_id, type, amount, frequency, start_date, next_due_date, auto_create | end_date, last_run_date | occorrenze future ricostruibili, stato no | Si | 8 |
| Prestiti | `loans` | `id` | `user_id` | auth user | counterpart, type, amount, remaining, is_settled | description, due_date, settled_at | paid = amount - remaining | Si | 9 |
| Pagamenti prestiti | `loan_payments` | `id` | `user_id` | loan_id | loan_id, amount, paid_at | notes | remaining verificabile | Si | 10 |
| Compleanni | `birthdays` | `id` | `user_id` | auth user | name, birth_date, reminder_days | notes | prossima data/eta' ricostruibile | Si | 11 |
| Log reminder compleanni | `birthday_reminder_log` | `id` | `user_id` | birthday_id | birthday_id, days_before, year | sent_at | ricostruibile solo parzialmente | Opzionale/consigliato | 12 |
| Audit log | `audit_logs` | `id` | `user_id` nullable | record_id logico | action, table_name | old_data, new_data, ip_address | non ricostruibile | Opzionale, privacy-sensitive | 13 |

## Dati non tabellari

- Preferenze UI non persistite: viste, filtri e checklist non hanno storage dedicato.
- Auth user/email: vive in Supabase Auth, non nelle tabelle public. Non va ripristinato dal backup applicativo; il restore deve usare l'utente autenticato corrente.
- File ricevute: `receipt_url` e `receipt_data` esistono sulle transazioni. Il backup JSON attuale include il riferimento/dati JSON, non necessariamente il file remoto.

## Dati derivati

- Patrimonio totale: somma conti attivi.
- Entrate/uscite/netto: derivati da transazioni non transfer.
- Speso budget: derivato da transazioni per mese/categoria.
- Proiezioni ricorrenti: derivate da recurring_rules.
- Stato prestito pagato: derivabile da loan_payments ma oggi `loans.remaining` e `is_settled` sono fonte diretta.

## Restore order sintetico

1. Profilo.
2. Account.
3. Categorie padre.
4. Sottocategorie.
5. Transazioni senza transfer peer circolare.
6. Trasferimenti e link peer/destination.
7. Budget.
8. Ricorrenze.
9. Prestiti.
10. Pagamenti prestiti.
11. Compleanni.
12. Reminder log.
13. Audit log se scelto.
