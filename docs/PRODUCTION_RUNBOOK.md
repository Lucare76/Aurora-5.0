# Aurora 5.0 — Production runbook

## Produzione

- App: `https://aurora-5-0.vercel.app`
- Health check: `https://aurora-5-0.vercel.app/api/health`
- Repository: `Lucare76/Aurora-5.0`
- Branch di produzione: `main`

## Cosa deve risultare sano

`GET /api/health` deve rispondere HTTP 200 con JSON contenente almeno:

```json
{
  "ok": true,
  "database": "ok"
}
```

Il workflow GitHub Actions `Production health` esegue questo controllo ogni ora con retry. Un errore del database porta l'endpoint a rispondere 503.

## Controllo dopo un deploy

1. verificare che Vercel riporti il deployment di `main` come `success`;
2. verificare che CI sia verde;
3. aprire `/api/health` e controllare `ok: true` e `database: ok`;
4. per modifiche sensibili, eseguire uno smoke test del flusso toccato;
5. controllare i log Vercel se compaiono errori runtime.

## Flussi sensibili che richiedono smoke test

- login/registrazione;
- creazione/modifica/cancellazione movimento;
- trasferimenti tra conti;
- prestiti e pagamenti prestito;
- restore backup;
- funzioni che dipendono da RPC o nuove migration.

## Errori runtime

Gli error boundary inviano un payload limitato al layer server di osservabilita. I log strutturati redigono chiavi sensibili come password, token, cookie, email, IBAN, card, secret e key.

## Rollback operativo

Se un deploy introduce un problema:

1. fermare nuove modifiche su `main`;
2. identificare il primo commit/deploy problematico;
3. preferire un revert Git del commit o PR responsabile;
4. attendere CI e nuovo deploy Vercel;
5. verificare `/api/health`;
6. ripetere lo smoke test del flusso coinvolto.

Per problemi database, non eseguire rollback distruttivi alla cieca: confrontare prima la migration applicata, la compatibilita del codice precedente e lo stato dei dati.

## Backup

Il backup/restore e gia implementato. La verifica periodica consigliata e un restore su ambiente isolato, mai direttamente sulla produzione come primo test.

## Regola di rilascio

Per nuove funzioni: branch dedicato -> PR -> CI verde -> Preview verde -> merge -> deploy produzione -> smoke test se necessario.
