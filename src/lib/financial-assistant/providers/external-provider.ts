import { intentClassifierPrompt } from '../prompts/intent-classifier'
import { parameterExtractorPrompt } from '../prompts/parameter-extractor'
import { responseComposerPrompt } from '../prompts/response-composer'
import { FinancialAssistantProviderError } from './errors'
import { normalizeOpenAiUsage } from '../usage/openai'
import {
  aiComposedResponseSchema,
  aiIntentClassificationSchema,
  aiParameterExtractionSchema,
  intentClassificationJsonSchema,
  parameterExtractionJsonSchema,
  responseCompositionJsonSchema,
} from './schemas'
import type { ExternalProviderConfig } from './config'
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
  usage?: {
    input_tokens?: number
    output_tokens?: number
    total_tokens?: number
  } | null
}

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>
}

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
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
  constructor(private readonly config: ExternalProviderConfig) {}

  get status() {
    return { available: true, provider: this.config.provider, reason: null }
  }

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
    if (this.config.provider === 'anthropic') return requestAnthropicJson(this.config, params)
    if (this.config.provider === 'gemini') return requestGeminiJson(this.config, params)
    return requestOpenAiJson(this.config, params)
  }
}

async function requestOpenAiJson(config: ExternalProviderConfig, params: { name: string; prompt: string; schema: unknown; payload: unknown }): Promise<unknown> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          input: [
            { role: 'system', content: params.prompt },
            { role: 'user', content: JSON.stringify(params.payload) },
          ],
          max_output_tokens: config.maxOutputTokens,
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
      const usage = normalizeOpenAiUsage(data, config.model)
      if (usage) await config.onUsage?.(usage)
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

async function requestAnthropicJson(config: ExternalProviderConfig, params: { prompt: string; payload: unknown }): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxOutputTokens,
        system: `${params.prompt}\nRispondi esclusivamente con JSON valido e nessun testo aggiuntivo.`,
        messages: [{ role: 'user', content: JSON.stringify(params.payload) }],
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw new FinancialAssistantProviderError('Provider AI non disponibile.', 'REQUEST_FAILED')
    const data = (await response.json()) as AnthropicResponse
    const text = data.content?.find((item) => item.type === 'text' && typeof item.text === 'string')?.text
    if (!text) throw new FinancialAssistantProviderError('Risposta AI vuota.', 'INVALID_OUTPUT')
    return JSON.parse(text)
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

async function requestGeminiJson(config: ExternalProviderConfig, params: { prompt: string; payload: unknown }): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: `${params.prompt}\nRispondi esclusivamente con JSON valido.\n${JSON.stringify(params.payload)}` }],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: config.maxOutputTokens,
        },
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw new FinancialAssistantProviderError('Provider AI non disponibile.', 'REQUEST_FAILED')
    const data = (await response.json()) as GeminiResponse
    const text = data.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text
    if (!text) throw new FinancialAssistantProviderError('Risposta AI vuota.', 'INVALID_OUTPUT')
    return JSON.parse(text)
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
