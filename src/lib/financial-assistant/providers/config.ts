import type { AssistantProviderStatus } from './types'
import type { AIUsageRecord } from '../usage/types'

export type ExternalProviderName = 'openai' | 'anthropic' | 'gemini'

export type ExternalProviderConfig = {
  provider: ExternalProviderName
  apiKey: string
  model: string
  timeoutMs: number
  maxInputChars: number
  maxOutputTokens: number
  onUsage?: (usage: AIUsageRecord) => Promise<void> | void
}

function positiveInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

export function getFinancialAssistantAiStatus(env: NodeJS.ProcessEnv = process.env): AssistantProviderStatus {
  if (env.FINANCIAL_ASSISTANT_AI_ENABLED !== 'true') {
    return { available: false, provider: 'none', reason: 'FINANCIAL_ASSISTANT_AI_ENABLED non attivo.' }
  }
  if (env.FINANCIAL_ASSISTANT_ALLOW_ADMIN_KEY !== 'true') {
    return { available: false, provider: 'none', reason: 'Chiave amministratore AI non abilitata.' }
  }
  if ((env.FINANCIAL_ASSISTANT_AI_PROVIDER ?? '').toLowerCase() !== 'openai') {
    return { available: false, provider: 'none', reason: 'Provider AI non supportato o mancante.' }
  }
  if (!env.OPENAI_API_KEY) {
    return { available: false, provider: 'openai', reason: 'OPENAI_API_KEY mancante.' }
  }
  if (!env.FINANCIAL_ASSISTANT_AI_MODEL) {
    return { available: false, provider: 'openai', reason: 'Modello AI mancante.' }
  }
  return { available: true, provider: 'openai', reason: null }
}

export function getOpenAiProviderConfig(env: NodeJS.ProcessEnv = process.env): ExternalProviderConfig | null {
  const status = getFinancialAssistantAiStatus(env)
  if (!status.available || status.provider !== 'openai') return null
  return {
    provider: 'openai',
    apiKey: env.OPENAI_API_KEY ?? '',
    model: env.FINANCIAL_ASSISTANT_AI_MODEL ?? '',
    timeoutMs: positiveInt(env.FINANCIAL_ASSISTANT_AI_TIMEOUT_MS, 12_000, 1_000, 30_000),
    maxInputChars: positiveInt(env.FINANCIAL_ASSISTANT_AI_MAX_INPUT_CHARS, 4_000, 500, 8_000),
    maxOutputTokens: positiveInt(env.FINANCIAL_ASSISTANT_AI_MAX_OUTPUT_TOKENS, 800, 100, 2_000),
  }
}

export function getProviderDefaults(provider: ExternalProviderName, env: NodeJS.ProcessEnv = process.env): Omit<ExternalProviderConfig, 'apiKey'> {
  const common = {
    timeoutMs: positiveInt(env.FINANCIAL_ASSISTANT_AI_TIMEOUT_MS, 12_000, 1_000, 30_000),
    maxInputChars: positiveInt(env.FINANCIAL_ASSISTANT_AI_MAX_INPUT_CHARS, 4_000, 500, 8_000),
    maxOutputTokens: positiveInt(env.FINANCIAL_ASSISTANT_AI_MAX_OUTPUT_TOKENS, 800, 100, 2_000),
  }
  if (provider === 'anthropic') {
    return {
      provider,
      model: env.FINANCIAL_ASSISTANT_ANTHROPIC_MODEL ?? 'claude-3-5-haiku-latest',
      ...common,
    }
  }
  if (provider === 'gemini') {
    return {
      provider,
      model: env.FINANCIAL_ASSISTANT_GEMINI_MODEL ?? 'gemini-2.5-flash',
      ...common,
    }
  }
  return {
    provider,
    model: env.FINANCIAL_ASSISTANT_AI_MODEL ?? 'gpt-4.1-mini',
    ...common,
  }
}
