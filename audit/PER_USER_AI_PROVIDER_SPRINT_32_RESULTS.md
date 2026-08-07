# Aurora Sprint 32 - Personal AI Providers

## Executive summary

Sprint implementato con configurazione AI per utente, provider estendibile e fallback deterministico fail-closed. Le API key personali non vengono mai restituite al client, non vengono esportate nei backup e non modificano la logica finanziaria.

## Schema

Nuova migration locale:

- `supabase/migrations/00031_personal_ai_provider_settings.sql`

Tabella:

- `ai_provider_settings`

Campi principali:

- `user_id`
- `provider`
- `encrypted_api_key`
- `api_key_last4`
- `enabled`
- `connection_status`
- `last_checked_at`
- `last_error`
- `created_at`
- `updated_at`

La migration e idempotente: usa `create table if not exists`, `add column if not exists`, drop/recreate policy e trigger.

## Provider

Provider supportati:

- OpenAI
- Anthropic Claude
- Google Gemini

Il provider esterno implementa la stessa interfaccia usata dal Financial Assistant. La modalita deterministica resta disponibile quando la configurazione AI manca o fallisce.

## Encryption

Le API key vengono cifrate lato server con AES-256-GCM.

Segreti supportati:

- `AI_PROVIDER_SETTINGS_SECRET`
- `FINANCIAL_ASSISTANT_AI_KEY_ENCRYPTION_SECRET`

Il salvataggio di una nuova chiave viene bloccato se il segreto di cifratura non e configurato.

## RLS

Policy per `ai_provider_settings`:

- select own
- insert own
- update own
- delete own

Tutte usano il vincolo `auth.uid() = user_id`.

## UI

Nuova sezione in Impostazioni:

- titolo: `Provider AI`
- provider select
- API key personale
- stato connessione
- chiave mascherata
- toggle modalita intelligente
- pulsante `Salva provider AI`
- pulsante `Verifica connessione`

## Privacy

Non vengono esposti:

- API key
- encrypted API key
- user_id verso provider AI
- email verso provider AI
- token Supabase
- SQL
- service role

Il client riceve solo:

- provider
- enabled
- configured
- maskedApiKey
- connectionStatus
- lastCheckedAt
- lastError

## Fallback

Priorita:

1. API key utente
2. API key amministratore solo con `FINANCIAL_ASSISTANT_ALLOW_ADMIN_KEY=true`
3. modalita deterministica

La chiave amministratore non viene usata di default.

## Backup

Le impostazioni AI sono escluse dal backup. La scelta evita di esportare API key in chiaro o cifrate in un file locale.

## Restore

Il restore non sovrascrive impostazioni AI. Dopo un ripristino l'utente deve reinserire manualmente la propria API key.

## Test

Test aggiunti o aggiornati:

- cifratura e mascheramento API key
- formati provider OpenAI, Anthropic, Gemini
- payload client senza chiave cifrata
- test connessione senza prompt finanziari
- admin key fallback disabilitato di default
- route impostazioni AI
- route test connessione
- backup export senza impostazioni AI
- chat assistant con disponibilita AI per utente

## Verifiche

- `git status`: modifiche locali non staged, nessun commit.
- `npx tsc --noEmit`: passato.
- `npx vitest run`: passato, 109 file passati, 1 skipped; 1492 test passati, 14 skipped.
- `npm run test:coverage`: passato, 109 file passati, 1 skipped; 1492 test passati, 14 skipped.
- Coverage globale: statements 84.33%, branches 76.59%, functions 87.67%, lines 86.57%.
- `npm run build`: passato.
- `git diff --check`: passato. Presenti solo warning informativi CRLF/LF su Windows.

## Limiti residui

- La migration non e stata applicata a Supabase remoto.
- Il test connessione Anthropic/Gemini usa un ping minimo per validare autenticazione e raggiungibilita; non invia dati finanziari.
- Non e stata aggiunta una schermata separata: la configurazione vive nella pagina Impostazioni esistente.
