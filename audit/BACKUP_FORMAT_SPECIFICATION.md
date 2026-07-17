# Backup Format Specification - Aurora Backup v1

## Obiettivo

Definire un formato JSON versionato, validabile e migrabile per backup futuri. Non implementato in questo sprint.

## Struttura proposta

```json
{
  "format": "aurora-backup",
  "schemaVersion": 1,
  "appVersion": "5.0.0",
  "createdAt": "2026-07-17T12:00:00.000Z",
  "exportedBy": {
    "userId": "original-auth-user-id",
    "displayName": "Mario",
    "emailHash": "sha256:..."
  },
  "defaultCurrency": "EUR",
  "metadata": {
    "source": "aurora-web",
    "locale": "it-IT",
    "timezone": "Europe/Rome",
    "notes": null
  },
  "data": {
    "profile": {},
    "accounts": [],
    "categories": [],
    "transactions": [],
    "budgets": [],
    "recurringRules": [],
    "loans": [],
    "loanPayments": [],
    "birthdays": [],
    "birthdayReminderLog": [],
    "auditLogs": []
  },
  "integrity": {
    "recordCounts": {},
    "tableChecksums": {},
    "checksum": "sha256:..."
  }
}
```

## Campi obbligatori

- `format = aurora-backup`
- `schemaVersion`
- `appVersion`
- `createdAt`
- `data`
- `integrity.recordCounts`
- `integrity.checksum`

## Campi opzionali

- `exportedBy.displayName`
- `exportedBy.emailHash`
- `metadata.notes`
- `auditLogs`
- `birthdayReminderLog`
- `receipt_data`
- `receipt_url`

## Regole formato

- Date: ISO 8601 per timestamp; `YYYY-MM-DD` per campi date.
- Importi: numeri decimali JSON, mai stringhe localizzate.
- Valori null: preservare null dove il DB li consente.
- Enum: validare contro enum noti.
- Campi sconosciuti: warning, conservati in `metadata.unknownFields` solo se si progetta forward compatibility.
- Checksum: calcolato su JSON canonicalizzato senza il campo `integrity.checksum`.
- Record counts: per ogni array in `data`.

## ID

Includere sempre ID originali per audit e mapping. Il restore non deve fidarsi dello `user_id` del file; deve sostituirlo con l'utente autenticato.

## Saldi

Includere sia:

- `accounts.balance` come snapshot;
- verifica logica dei saldi derivata da transazioni, quando possibile.

Lo snapshot e' necessario per conti con saldo iniziale o correzioni manuali.

## Versionamento

- `schemaVersion` indica formato backup.
- `appVersion` indica app esportatrice.
- Ogni versione futura deve avere migratore puro `vN -> vN+1`.
- Versioni future non supportate: bloccare restore, permettere solo ispezione.

## Dati derivati

Non includere dashboard/report aggregati come fonte di verita'. Si possono includere in `integrity.logicalChecksums` per confronto.
