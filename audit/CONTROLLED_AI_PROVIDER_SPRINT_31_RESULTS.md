# Sprint 31 - Provider AI controllato per "Chiedi ad Aurora"

## Stato

Completato. Il provider AI e opzionale, server-side e disattivato di default.

## Architettura scelta

- Motore deterministico Sprint 29/30 mantenuto come sorgente di verita.
- Provider opzionale unico: OpenAI Responses API via `fetch` server-side.
- Nessun SDK aggiunto e nessuna dipendenza nuova.
- Nessuna nuova route.
- Nessuna migration, RPC o modifica Supabase.

## Guardrail

- `FINANCIAL_ASSISTANT_AI_ENABLED=false` di default.
- Se provider, modello o chiave mancano, Aurora resta in modalita essenziale.
- Il parser deterministico ad alta confidenza non usa AI per classificare.
- Le richieste di scrittura o prompt injection restano bloccate prima del provider.
- Scope, ownership, intent e tool sono rivalidati server-side.
- Il provider non riceve user id, email, SQL, service role o righe Supabase raw.
- Le risposte AI sono validate contro le evidenze deterministiche.

## File creati

- `src/lib/financial-assistant/providers/types.ts`
- `src/lib/financial-assistant/providers/errors.ts`
- `src/lib/financial-assistant/providers/config.ts`
- `src/lib/financial-assistant/providers/deterministic-provider.ts`
- `src/lib/financial-assistant/providers/external-provider.ts`
- `src/lib/financial-assistant/providers/factory.ts`
- `src/lib/financial-assistant/providers/schemas.ts`
- `src/lib/financial-assistant/providers/redaction.ts`
- `src/lib/financial-assistant/providers/evidence-lock.ts`
- `src/lib/financial-assistant/prompts/versions.ts`
- `src/lib/financial-assistant/prompts/intent-classifier.ts`
- `src/lib/financial-assistant/prompts/parameter-extractor.ts`
- `src/lib/financial-assistant/prompts/response-composer.ts`
- `tests/unit/financial-assistant/provider-privacy.test.ts`

## File modificati

- `.env.example`
- `src/app/api/financial-assistant/chat/route.ts`
- `src/app/api/financial-assistant/capabilities/route.ts`
- `src/app/(app)/assistant/AssistantClient.tsx`
- `src/app/(app)/assistant/chat-ui.ts`
- `tests/api/financial-assistant-chat-route.test.ts`
- `tests/unit/financial-assistant/chat-ui.test.ts`

## Test creati

- Configurazione fail-closed del provider.
- Redazione di email e UUID prima del payload AI.
- Validazione anti-invenzione numerica della composizione.
- Payload UI con privacy mode e consenso esplicito.
- API: modalita essenziale senza invocazione provider.
- API: classificazione AI solo con consenso e payload redatto.

## Esiti verifiche

- `git status --short`: solo modifiche Sprint 31 non committate.
- `npx tsc --noEmit`: verde.
- `npx vitest run tests/unit/financial-assistant tests/api/financial-assistant-chat-route.test.ts`: 59 passed.
- `npx vitest run`: 104 test file passed, 1 skipped; 1459 test passed, 14 skipped.
- `npm run test:coverage`: 104 test file passed, 1 skipped; 1459 test passed, 14 skipped.
- Coverage globale: statements 85.52%, branches 77.59%, functions 88.17%, lines 87.65%.
- `npm run build`: verde.
- `git diff --check`: verde; solo warning CRLF Windows.

## Limiti residui

- Il provider resta spento finche non vengono configurate variabili server-side e consenso UI.
- Non vengono salvate conversazioni.
- Non viene introdotta memoria conversazionale o RAG.
- Non sono stati eseguiti commit, push, deploy o migration remote.
