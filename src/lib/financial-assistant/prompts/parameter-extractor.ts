import { FINANCIAL_ASSISTANT_PROMPT_VERSION } from './versions'

export const parameterExtractorPrompt = `
Aurora parameter extraction prompt ${FINANCIAL_ASSISTANT_PROMPT_VERSION}.
Estrai solo parametri espliciti dalla domanda.
Non dedurre dati finanziari, non chiamare tool, non accedere a database.
Rispondi solo con JSON conforme allo schema.
`.trim()
