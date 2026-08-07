import { describe, expect, it } from 'vitest'
import { buildAssistantResult } from '@/lib/financial-assistant/response-contract'
import { getFinancialAssistantAiStatus, getOpenAiProviderConfig } from '@/lib/financial-assistant/providers/config'
import { validateComposedResponseAgainstFacts } from '@/lib/financial-assistant/providers/evidence-lock'
import { buildAiClassificationPayload, buildAiCompositionPayload } from '@/lib/financial-assistant/providers/redaction'

describe('controlled AI provider privacy and config', () => {
  it('fallisce chiuso se il flag AI non e attivo', () => {
    const status = getFinancialAssistantAiStatus({ FINANCIAL_ASSISTANT_AI_ENABLED: 'false' } as unknown as NodeJS.ProcessEnv)
    expect(status.available).toBe(false)
    expect(getOpenAiProviderConfig({ FINANCIAL_ASSISTANT_AI_ENABLED: 'false' } as unknown as NodeJS.ProcessEnv)).toBeNull()
  })

  it('non considera disponibile il provider senza chiave o modello', () => {
    expect(getFinancialAssistantAiStatus({
      FINANCIAL_ASSISTANT_AI_ENABLED: 'true',
      FINANCIAL_ASSISTANT_AI_PROVIDER: 'openai',
    } as unknown as NodeJS.ProcessEnv).available).toBe(false)
  })

  it('redige identificativi e email prima del payload AI', () => {
    const payload = buildAiClassificationPayload({
      message: 'Saldo di luca@example.com 123e4567-e89b-12d3-a456-426614174000',
      requestedScope: 'PERSONAL',
      allowedScopes: ['PERSONAL'],
      allowedIntents: [{
        intent: 'personal.financial_summary',
        scope: 'PERSONAL',
        label: 'Riepilogo',
        description: 'Riepilogo personale',
      }],
    })
    expect(JSON.stringify(payload)).not.toContain('luca@example.com')
    expect(JSON.stringify(payload)).not.toContain('123e4567-e89b-12d3-a456-426614174000')
  })

  it('costruisce composizione senza dati tecnici sensibili', () => {
    const result = buildAssistantResult({
      status: 'OK',
      intent: 'personal.financial_summary',
      scope: 'PERSONAL',
      answer: 'Patrimonio totale 1000 EUR.',
      evidence: [{ metric: 'netWorth', value: 1000, unit: 'EUR', citationIds: ['accounts'] }],
      citations: [{ id: 'accounts', label: 'Conti', table: 'accounts', fields: ['balance'], rowCount: 2, filteredBy: ['scope'] }],
    })
    const payload = buildAiCompositionPayload('Quanto ho?', result)
    expect(payload.allowedFacts.some((fact) => fact.includes('1000'))).toBe(true)
    expect(JSON.stringify(payload)).not.toContain('service_role')
  })

  it('rifiuta risposte AI con numeri non presenti nelle evidenze', () => {
    expect(() => validateComposedResponseAgainstFacts(
      { answer: 'Hai 2000 EUR.', summary: [] },
      ['answer: Hai 1000 EUR.'],
    )).toThrow(/numeri/)
  })
})
