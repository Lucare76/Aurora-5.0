import { defaultAssistantSuggestions, privateAssistantSuggestions } from '@/lib/financial-assistant/natural-language'
import type { FinancialAssistantScope } from '@/lib/financial-assistant/types'

export type AssistantCapability = {
  intent: string
  label: string
  description: string
  scope: FinancialAssistantScope
  readOnly: boolean
}

export type AssistantCapabilitiesResponse = {
  enabled: boolean
  readOnly: true
  version: string
  scopes: FinancialAssistantScope[]
  capabilities: AssistantCapability[]
  aiAvailable?: boolean
  aiProvider?: 'none' | 'openai' | 'anthropic' | 'gemini'
  aiUnavailableReason?: string | null
  deterministicModeAvailable?: boolean
  responseEnhancementAvailable?: boolean
}

export type AssistantPrivacyMode = 'ESSENTIAL_ONLY' | 'SMART_REDACTED'

export function visibleAssistantSuggestions(capabilities: AssistantCapabilitiesResponse | null): string[] {
  if (!capabilities?.enabled) return []
  const suggestions = [...defaultAssistantSuggestions]
  const scopes = new Set(capabilities.scopes)
  if (scopes.has('AURORA')) suggestions.push(privateAssistantSuggestions[0])
  if (scopes.has('ADI')) suggestions.push(privateAssistantSuggestions[1])
  return suggestions
}

export function visibleAssistantScopes(capabilities: AssistantCapabilitiesResponse | null): FinancialAssistantScope[] {
  if (!capabilities?.enabled) return []
  return capabilities.scopes.filter((scope) => scope === 'PERSONAL' || scope === 'AURORA' || scope === 'ADI')
}

export function buildAssistantChatPayload(
  message: string,
  scope: FinancialAssistantScope,
  draft: Record<string, unknown> | null = null,
  privacyMode: AssistantPrivacyMode = 'ESSENTIAL_ONLY',
  aiConsent = false,
) {
  return { message: message.trim(), scope, draft, privacyMode, aiConsent }
}

export function appendMissingInputToMessage(message: string, field: string, value: string): string {
  const cleanValue = value.trim()
  if (!cleanValue) return message
  const label = field === 'price' ? 'costo' : field
  return `${message.trim()} ${label} ${cleanValue}`.trim()
}

export function assistantModeLabel(capabilities: AssistantCapabilitiesResponse | null, privacyMode: AssistantPrivacyMode, aiConsent: boolean): string {
  if (capabilities?.aiAvailable && privacyMode === 'SMART_REDACTED' && aiConsent) return 'Modalita intelligente'
  return 'Modalita essenziale'
}

export function canUseSmartAssistant(capabilities: AssistantCapabilitiesResponse | null): boolean {
  return Boolean(capabilities?.enabled && capabilities.aiAvailable)
}

export function assistantProviderBadgeLabel(capabilities: AssistantCapabilitiesResponse | null): string {
  if (!capabilities?.aiAvailable) return 'Nessun modello esterno'
  if (capabilities.aiProvider === 'anthropic') return 'Claude personale'
  if (capabilities.aiProvider === 'gemini') return 'Gemini personale'
  return 'OpenAI personale'
}
