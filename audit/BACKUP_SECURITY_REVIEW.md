# Backup Security Review

## Dati sensibili nel backup

Il backup puo' contenere:

- nomi conti;
- saldi;
- descrizioni e note movimenti;
- controparti prestiti;
- compleanni;
- ricevute o metadata ricevute;
- timezone/locale/nome profilo;
- audit log con dati vecchi/nuovi.

## Rischi principali

- File scaricato dal browser e salvato in chiaro.
- Condivisione accidentale del JSON.
- Restore cross-user malevolo.
- Payload enorme o malevolo.
- Log applicativi con contenuti finanziari.
- User_id nel file usato impropriamente.
- Campi sconosciuti sfruttati come payload.
- Restore ripetuto o CSRF.

## Regole sicurezza

- Non fidarsi mai dello `user_id` nel file.
- Forzare ownership a `auth.uid()`.
- Validare schema prima di qualsiasi scrittura.
- Non loggare descrizioni, note, importi puntuali o saldi.
- Limitare dimensione upload.
- Rate limit lato server per restore futuro.
- Dry-run obbligatorio.
- Conferma testuale esplicita.
- Nessun service role lato client.
- RLS sempre attiva; eventuale RPC restore deve fare controlli ownership espliciti.
- Cancellare file temporanei appena finito.

## Privacy

Il backup e' un export completo dei dati personali. La UI futura deve avvisare:

- "Questo file contiene dati finanziari personali";
- "Conservalo in un luogo sicuro";
- "Non inviarlo a terzi";
- "Aurora non puo' proteggere file gia' scaricati".

## Cifratura futura

Non obbligatoria nella prima versione, ma raccomandata:

- esportazione cifrata con password locale;
- KDF robusto;
- mai inviare password al server;
- warning forte se backup non cifrato.

## Error reporting

Gli errori devono riportare codici e conteggi, non contenuto:

- ok: `TRANSACTION_ACCOUNT_MISSING row=42`;
- no: descrizione movimento, importo, note.
