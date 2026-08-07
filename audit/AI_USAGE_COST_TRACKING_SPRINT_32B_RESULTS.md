# Sprint 32B - AI Usage & Estimated Cost Tracking

## Executive summary

Sprint implementato con tracking giornaliero aggregato dell'utilizzo AI per utente. Il tracking registra solo contatori tecnici: provider, modello, data, richieste, token e costo stimato. Non salva prompt, risposte, conversazioni, evidenze finanziarie, API key o riferimenti contabili.

## Migration

Nuova migration locale:

- `supabase/migrations/00032_ai_usage_tracking.sql`

Non e stata applicata a Supabase remoto.

## Schema

Tabella:

- `ai_usage_daily`

Campi:

- `user_id`
- `provider`
- `model`
- `usage_date`
- `request_count`
- `input_tokens`
- `output_tokens`
- `total_tokens`
- `estimated_cost_usd`
- `last_request_at`
- `created_at`
- `updated_at`

Unique:

- `user_id, provider, model, usage_date`

## RLS

RLS abilitata con policy ownership basate su:

- `auth.uid() = user_id`

Nessun utente puo leggere usage di altri utenti.

## Aggregazione atomica

Creata RPC:

- `increment_ai_usage_daily(...)`

La RPC usa `insert ... on conflict ... do update` e incrementa atomicamente:

- `request_count`
- `input_tokens`
- `output_tokens`
- `total_tokens`
- `estimated_cost_usd`
- `last_request_at`

La RPC rifiuta `p_user_id` diverso da `auth.uid()`.

## Pricing registry

Nuovi moduli:

- `src/lib/financial-assistant/pricing/types.ts`
- `src/lib/financial-assistant/pricing/registry.ts`
- `src/lib/financial-assistant/pricing/calculator.ts`

Pricing implementato per i modelli OpenAI usati da Aurora:

- `gpt-4.1-mini`
- `gpt-4.1-mini-2025-04-14`
- `gpt-5-mini`
- `gpt-5-mini-2025-08-07`

Fonte prezzi:

- OpenAI model pricing ufficiale, revisionato il 2026-08-07.

## Usage OpenAI

Nuovo modulo:

- `src/lib/financial-assistant/usage/openai.ts`

La normalizzazione usa il campo `usage` restituito dalla Responses API:

- `input_tokens`
- `output_tokens`
- `total_tokens`

Non stima token dal testo.

## Claude e Gemini

Architettura compatibile tramite `AIUsageRecord`.

In questo sprint non viene calcolato pricing per Claude/Gemini. Se il costo non e disponibile la UI mostra:

- `Costo non disponibile`

## API

Nuova route:

- `GET /api/ai-provider/usage`

Restituisce:

- oggi
- mese corrente
- richieste
- token input/output/totali
- costo stimato
- provider
- modelli
- ultima richiesta

Non restituisce:

- user_id
- email
- API key
- prompt
- risposte
- dati finanziari

## UI

Nella sezione `Impostazioni -> Provider AI` e stato aggiunto il pannello:

- `Utilizzo AI`

Mostra:

- Oggi: richieste, token, costo stimato
- Mese corrente: provider, modello, richieste, token input/output/totali, costo stimato, ultima richiesta
- nota sul carattere stimato del costo

Riutilizza `StatusBadge`.

## Privacy

`ai_usage_daily` non contiene:

- prompt
- response
- domanda utente
- email
- API key
- account_id
- transaction_id
- evidenze
- dati Aurora
- dati ADI

## Backup e restore

`ai_usage_daily` e esclusa dal backup e dal restore.

Motivo: e telemetria tecnica, non dato finanziario primario.

## Test

Test aggiunti o aggiornati:

- pricing modello OpenAI noto
- modello OpenAI sconosciuto
- input/output/total cost
- zero token
- valori grandi
- precisione e cambio modello
- normalizzazione usage OpenAI
- registrazione RPC senza payload sensibili
- aggregazione summary
- API 401
- API usage vuoto
- API usage presente
- costo null
- errore DB sanificato
- migration statica RLS/RPC/privacy
- backup senza `ai_usage_daily`

## Verifiche

- `git status`: modifiche locali non staged; nessun commit.
- `npx tsc --noEmit`: passato.
- `npx vitest run`: passato, 113 file passati, 1 skipped; 1514 test passati, 14 skipped.
- `npm run test:coverage`: passato, 113 file passati, 1 skipped; 1514 test passati, 14 skipped.
- Coverage globale: statements 84.32%, branches 76.55%, functions 87.38%, lines 86.56%.
- `npm run build`: passato.
- `git diff --check`: passato. Presenti solo warning informativi CRLF/LF su Windows.

## Limiti residui

- La migration non e stata applicata a Supabase remoto.
- Claude/Gemini non hanno pricing registry in questo sprint.
- Il costo e stimato e puo differire dalla fatturazione effettiva del provider.
- Non e stato introdotto `credentialSource`; se la chiave admin viene abilitata esplicitamente, lo usage resta comunque associato all'utente che genera la richiesta.
- Il target nuovo codice e rispettato per i moduli pricing in modo sostanziale e per `usage/openai.ts` su statements/functions/lines al 100%; branch coverage di `usage/openai.ts` resta a 87.5% per una micro-ramificazione di normalizzazione token.
