# Current Export Audit - Aurora 5.0

## Export disponibili

### 1. CSV transazioni da Impostazioni

Origine: `src/app/(app)/settings/page.tsx`, funzione `exportTransactions`.

Select:

- `transactions`: `id,user_id,account_id,category_id,type,amount,description,notes,date,transfer_peer_id,recurring_id,receipt_url,receipt_data,created_at,updated_at`
- `categories`: `id,name`
- `accounts`: `id,name,user_id`

Trasformazione:

- usa `adaptTransactionRows`;
- usa `buildTransactionExportRows`;
- produce CSV con data, tipo, descrizione, categoria, conto, conto destinazione, importo, transfer kind.

Completezza restore: bassa. E' export leggibile, non backup.

Perdita potenziale:

- dati conto completi non inclusi;
- categorie complete non incluse;
- user_id e ID relazionali non tutti preservati in forma ripristinabile;
- budget, ricorrenze, prestiti, compleanni assenti.

### 2. CSV report

Origine: `src/app/(app)/reports/page.tsx`, funzione `exportCSV`.

Scopo: esportare vista/report del periodo selezionato.

Completezza restore: nulla. Serve ad analisi esterna.

Limiti:

- dati aggregati o filtrati;
- non e' idempotente;
- non contiene relazioni complete.

### 3. Import/Export CSV movimenti

Origine import: `src/app/(app)/transactions/page.tsx`.

Scopo: reimportare CSV compatibile Aurora per movimenti.

Completezza restore: parziale. Utile solo per movimenti semplici, non per ricostruire l'app.

Rischi:

- richiede scelta conto target;
- categorie possono non essere ricostruite;
- trasferimenti e relazioni possono degradare;
- non include tutte le entita'.

### 4. Backup completo JSON

Origine: `src/app/(app)/settings/page.tsx`, funzione `exportBackup`.

Select attuali:

- `transactions` con `TRANSACTION_SELECT`;
- `accounts` `*`;
- `categories` `*`;
- `budgets` `*`;
- `recurring_rules` `*`;
- `loans` `*`;
- `loan_payments` `*`;
- `birthdays` `*`.

Formato attuale:

```json
{
  "exported_at": "ISO date",
  "version": "5.0",
  "data": {
    "accounts": [],
    "categories": [],
    "transactions": [],
    "budgets": [],
    "recurring_rules": [],
    "loans": [],
    "loan_payments": [],
    "birthdays": []
  }
}
```

Completezza restore: media, ma non sufficiente per restore sicuro.

Campi esclusi:

- `profiles`;
- `audit_logs`;
- `birthday_reminder_log`;
- auth metadata/email;
- eventuali storage files reali per `receipt_url`;
- metadata di integrita';
- record counts;
- checksum;
- schemaVersion formale;
- appVersion separata;
- exportedBy/user identity controllata;
- formato importi/date dichiarato.

Punti positivi:

- include dati core: conti, categorie, transazioni, budget, ricorrenze, prestiti, compleanni;
- usa `select('*')` per molte tabelle, quindi preserva campi correnti;
- JSON non trasforma importi in testo.

Limiti:

- nessun validatore;
- nessuna specifica;
- nessun restore;
- nessun ordine di ripristino;
- nessuna protezione da collisioni ID;
- nessuna verifica di trasferimenti;
- nessuna garanzia su conteggi e checksum.

## Conclusione

Il backup completo attuale e' un buon dump applicativo parziale, non un formato di backup/restore affidabile. Può aiutare un recupero manuale, ma non basta per ricostruire Aurora in modo automatico e sicuro.
