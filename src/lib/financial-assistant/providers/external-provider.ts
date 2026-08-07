import { intentClassifierPrompt } from '../prompts/intent-classifier'
import { parameterExtractorPrompt } from '../prompts/parameter-extractor'
import { responseComposerPrompt } from '../prompts/response-composer'
import { FinancialAssistantProviderError } from './errors'
import {
  aiComposedResponseSchema,
  aiIntentClassificationSchema,
  aiParameterExtractionSchema,
  intentClassificationJsonSchema,
  parameterExtractionJsonSchema,
  responseCompositionJsonSchema,
} from './schemas'
import type { OpenAiProviderConfig } from './config'
import type {
  AiComposedResponse,
  AiIntentClassification,
  AiIntentClassificationInput,
  AiParameterExtraction,
  AiParameterExtractionInput,
  AiResponseCompositionInput,
  FinancialLanguageProvider,
} from './types'

type OpenAiResponse = {
  output_text?: string
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>
}

function trimPayload<T>(input: T, maxChars: number): T {
  const serialized = JSON.stringify(input)
  if (serialized.length <= maxChars) return input
  return JSON.parse(JSON.stringify(input, (_key, value) => (typeof value === 'string' ? value.slice(0, 500) : value))) as T
}

function extractText(data: OpenAiResponse): string {
  if (typeof data.output_text === 'string') return data.output_text
  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text
    }
  }
  throw new FinancialAssistantProviderError('Risposta AI vuota.', 'INVALID_OUTPUT')
}

export class OpenAiFinancialLanguageProvider implements FinancialLanguageProvider {
  readonly status = { available: true, provider: 'openai' as const, reason: null }

  constructor(private readonly config: OpenAiProviderConfig) {}

  async classifyIntent(input: AiIntentClassificationInput): Promise<AiIntentClassification> {
    const parsed = await this.requestJson({
      name: 'aurora_intent_classification',
      prompt: intentClassifierPrompt,
      schema: intentClassificationJsonSchema,
      payload: trimPayload(input, this.config.maxInputChars),
    })
    return aiIntentClassificationSchema.parse(parsed)
  }

  async extractParameters(input: AiParameterExtractionInput): Promise<AiParameterExtraction> {
    const parsed = await this.requestJson({
      name: 'aurora_parameter_extraction',
      prompt: parameterExtractorPrompt,
      schema: parameterExtractionJsonSchema,
      payload: trimPayload(input, this.config.maxInputChars),
    })
    return aiParameterExtractionSchema.parse(parsed)
  }

  async composeResponse(input: AiResponseCompositionInput): Promise<AiComposedResponse> {
    const parsed = await this.requestJson({
      name: 'aurora_response_composition',
      prompt: responseComposerPrompt,
      schema: responseCompositionJsonSchema,
      payload: trimPayload(input, this.config.maxInputChars),
    })
    return aiComposedResponseSchema.parse(parsed)
  }

  private async requestJson(params: { name: string; prompt: string; schema: unknown; payload: unknown }): Promise<unknown> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs)
    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          input: [
            { role: 'system', content: params.prompt },
            { role: 'user', content: JSON.stringify(params.payload) },
          ],
          max_output_tokens: this.config.maxOutputTokens,
          text: {
            format: {
              type: 'json_schema',
              name: params.name,
              strict: true,
              schema: params.schema,
            },
          },
          tools: [],
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new FinancialAssistantProviderError('Provider AI non disponibile.', 'REQUEST_FAILED')
      }
      const data = (await response.json()) as OpenAiResponse
      return JSON.parse(extractText(data))
    } catch (error) {
      if (error instanceof FinancialAssistantProviderError) throw error
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new FinancialAssistantProviderError('Timeout provider AI.', 'TIMEOUT')
      }
      throw new FinancialAssistantProviderError('Output AI non valido.', 'INVALID_OUTPUT')
    } finally {
      clearTimeout(timeout)
    }
  }
}
