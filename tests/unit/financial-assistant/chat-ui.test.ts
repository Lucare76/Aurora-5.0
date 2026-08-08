import { describe, expect, it } from 'vitest'
import {
  appendMissingInputToMessage,
  assistantModeLabel,
  assistantProviderBadgeLabel,
  buildAssistantChatPayload,
  canUseSmartAssistant,
  visibleAssistantScopes,
  visibleAssistantSuggestions,
  type AssistantCapabilitiesResponse,
} from '@/app/(app)/assistant/chat-ui'

const baseCapabilities: AssistantCapabilitiesResponse = {
  enabled: true,
  readOnly: true as const,
  version: '29.0.0',
  scopes: ['PERSONAL'],
  capabilities: [],
}

describe('assistant chat UI logic', () => {
  it('mostra solo suggerimenti personali se non ci sono scope privati', () => {
    const suggestions = visibleAssistantSuggestions(baseCapabilities)
    expect(suggestions.some((item) => item.includes('Aurora'))).toBe(false)
    expect(suggestions.some((item) => item.includes('ADI'))).toBe(false)
  })

  it('filtra scope e suggerimenti privati dalle capability server', () => {
    const capabilities: AssistantCapabilitiesResponse = { ...baseCapabilities, scopes: ['PERSONAL', 'AURORA', 'ADI'] }
    expect(visibleAssistantScopes(capabilities)).toEqual(['PERSONAL', 'AURORA', 'ADI'])
    expect(visibleAssistantSuggestions(capabilities).some((item) => item.includes('risparmi di Aurora'))).toBe(true)
    expect(visibleAssistantSuggestions(capabilities).some((item) => item.includes('ADI'))).toBe(true)
  })

  it('costruisce payload senza user_id o proprietà tecniche', () => {
    expect(buildAssistantChatPayload(' Quanto ho speso? ', 'PERSONAL')).toEqual({
      message: 'Quanto ho speso?',
      scope: 'PERSONAL',
      draft: null,
      privacyMode: 'ESSENTIAL_ONLY',
      aiConsent: false,
    })
  })

  it('aggiunge un input mancante alla domanda locale senza salvare dati', () => {
    expect(appendMissingInputToMessage('Posso permettermi una spesa?', 'price', '2.000 €')).toBe('Posso permettermi una spesa? costo 2.000 €')
  })

  it('mostra la modalita intelligente solo quando AI e consenso sono attivi', () => {
    const capabilities: AssistantCapabilitiesResponse = { ...baseCapabilities, aiAvailable: true }
    expect(canUseSmartAssistant(capabilities)).toBe(true)
    expect(assistantModeLabel(capabilities, 'SMART_REDACTED', true)).toBe('Modalita intelligente')
    expect(assistantModeLabel(capabilities, 'SMART_REDACTED', false)).toBe('Modalita essenziale')
  })

  it('mostra il provider personale solo quando la capability AI e disponibile', () => {
    expect(assistantProviderBadgeLabel({ ...baseCapabilities, aiAvailable: false, aiProvider: 'none' })).toBe('Nessun modello esterno')
    expect(assistantProviderBadgeLabel({ ...baseCapabilities, aiAvailable: true, aiProvider: 'openai' })).toBe('OpenAI personale')
    expect(assistantProviderBadgeLabel({ ...baseCapabilities, aiAvailable: true, aiProvider: 'gemini' })).toBe('Gemini personale')
  })
})
