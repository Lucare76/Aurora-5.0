import type { AssistantResult, FinancialAssistantIntent, FinancialAssistantPeriod, FinancialAssistantScope } from '../types'
import type { ParserConfidence } from '../natural-language'

export type AssistantPrivacyMode = 'ESSENTIAL_ONLY' | 'SMART_REDACTED'
export type AssistantProviderKind = 'none' | 'openai' | 'anthropic' | 'gemini'

export type AssistantProviderStatus = {
  available: boolean
  provider: AssistantProviderKind
  reason: string | null
}

export type AiIntentClassification = {
  supported: boolean
  confidence: ParserConfidence
  intent: FinancialAssistantIntent | null
  scope: FinancialAssistantScope | null
  period: FinancialAssistantPeriod | null
  parameters: Record<string, unknown>
  missingInputs: string[]
  reason: string | null
}

export type AiParameterExtraction = {
  period: FinancialAssistantPeriod | null
  parameters: Record<string, unknown>
  missingInputs: string[]
}

export type AiComposedResponse = {
  answer: string
  summary: string[]
}

export type AiIntentClassificationInput = {
  message: string
  requestedScope: FinancialAssistantScope
  allowedScopes: FinancialAssistantScope[]
  allowedIntents: Array<{
    intent: FinancialAssistantIntent
    scope: FinancialAssistantScope
    label: string
    description: string
  }>
}

export type AiParameterExtractionInput = AiIntentClassificationInput & {
  intent: FinancialAssistantIntent
}

export type AiResponseCompositionInput = {
  message: string
  result: AssistantResult
  allowedFacts: string[]
}

export type FinancialLanguageProvider = {
  readonly status: AssistantProviderStatus
  classifyIntent(input: AiIntentClassificationInput): Promise<AiIntentClassification>
  extractParameters(input: AiParameterExtractionInput): Promise<AiParameterExtraction>
  composeResponse(input: AiResponseCompositionInput): Promise<AiComposedResponse>
}

export type AssistantAiMode = {
  privacyMode: AssistantPrivacyMode
  aiAvailable: boolean
  deterministicModeAvailable: true
  responseEnhancementAvailable: boolean
  aiClassificationUsed: boolean
  aiExtractionUsed: boolean
  aiCompositionUsed: boolean
  deterministicFallbackUsed: boolean
}
