# Observability — Sprint Results

Data: 17 settembre 2026
Branch: `feat/observability`

## Obiettivo

Rendere Aurora osservabile in produzione senza introdurre un servizio esterno obbligatorio o nuovi costi.

## Implementazione

- logger strutturato JSON server-side con release/environment e sanitizzazione metadata;
- redazione automatica di chiavi sensibili (password, token, cookie, email, IBAN, card, secret, key);
- endpoint `GET /api/health` che verifica applicazione e connettività Supabase e risponde 503 in caso di errore;
- endpoint `POST /api/observability/client-error` che riceve solo un payload client limitato e lo porta nei log server/Vercel;
- integrazione dell'error boundary esistente con reporting automatico;
- nuovo `global-error.tsx` per errori che superano il normale boundary;
- GitHub Actions `Production health` ogni ora contro `https://aurora-5-0.vercel.app/api/health` con retry;
- test unitari per redazione e limiti del logger.

## Privacy e sicurezza

Nessun body di richieste, credenziale Supabase o identificatore finanziario viene loggato dal nuovo layer. Il logger redige le chiavi sensibili e tronca stringhe/array troppo grandi. Il collector browser accetta solo campi noti e limita le lunghezze.

## Alerting

Il controllo orario fallisce il workflow GitHub Actions se applicazione o database non rispondono correttamente. Il fallimento resta visibile nella tab Actions e può sfruttare le normali notifiche GitHub dell'account/repository.

## Limiti volutamente mantenuti

Non viene introdotto Sentry, Datadog o altro vendor esterno: nessun costo, nessuna nuova credenziale e nessuna copia aggiuntiva dei dati. Se in futuro serviranno alert push dedicati, tracing distribuito o raggruppamento automatico degli stack trace, questo layer costituisce la base su cui collegare un provider.
