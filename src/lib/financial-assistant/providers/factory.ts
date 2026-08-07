import { getFinancialAssistantAiStatus, getOpenAiProviderConfig } from './config'
import { createDeterministicProvider } from './deterministic-provider'
import { OpenAiFinancialLanguageProvider } from './external-provider'
import type { AssistantProviderStatus, FinancialLanguageProvider } from './types'

export function getAssistantProviderStatus(): AssistantProviderStatus {
  return getFinancialAssistantAiStatus()
}

export function createFinancialLanguageProvider(): FinancialLanguageProvider {
  const config = getOpenAiProviderConfig()
  if (!config) return createDeterministicProvider(getFinancialAssistantAiStatus().reason ?? 'Provider AI non disponibile.')
  return new OpenAiFinancialLanguageProvider(config)
}

export function isAssistantAiAvailable(): boolean {
  return getAssistantProviderStatus().available
}
