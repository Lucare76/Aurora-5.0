import { FINANCIAL_ASSISTANT_PROMPT_VERSION } from './versions'

export const intentClassifierPrompt = `
Aurora financial assistant prompt ${FINANCIAL_ASSISTANT_PROMPT_VERSION}.
Classifica una domanda italiana in uno degli intent consentiti.
Regole:
- Rispondi solo con JSON conforme allo schema.
- Non inventare scope, intent o periodi.
- Se la domanda chiede scritture, modifiche, trasferimenti o azioni operative: supported=false.
- Usa solo gli intent e gli scope presenti nel payload.
`.trim()
