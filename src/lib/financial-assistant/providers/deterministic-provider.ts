import { FinancialAssistantProviderError } from './errors'
import type {
  AiComposedResponse,
  AiIntentClassification,
  AiIntentClassificationInput,
  AiParameterExtraction,
  AiParameterExtractionInput,
  AiResponseCompositionInput,
  FinancialLanguageProvider,
} from './types'

export function createDeterministicProvider(reason = 'AI provider non configurato.'): FinancialLanguageProvider {
  const unavailable = () => Promise.reject(new FinancialAssistantProviderError(reason, 'UNAVAILABLE'))

  return {
    status: { available: false, provider: 'none', reason },
    classifyIntent(_input: AiIntentClassificationInput): Promise<AiIntentClassification> {
      return unavailable()
    },
    extractParameters(_input: AiParameterExtractionInput): Promise<AiParameterExtraction> {
      return unavailable()
    },
    composeResponse(_input: AiResponseCompositionInput): Promise<AiComposedResponse> {
      return unavailable()
    },
  }
}
