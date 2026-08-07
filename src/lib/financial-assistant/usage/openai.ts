import type { AIUsageRecord } from './types'

type OpenAiUsagePayload = {
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
}

export function normalizeOpenAiUsage(data: { usage?: OpenAiUsagePayload | null }, model: string): AIUsageRecord | null {
  const usage = data.usage
  if (!usage) return null
  const inputTokens = nonNegativeInt(usage.input_tokens)
  const outputTokens = nonNegativeInt(usage.output_tokens)
  const totalTokens = nonNegativeInt(usage.total_tokens ?? inputTokens + outputTokens)
  return {
    provider: 'OPENAI',
    model,
    inputTokens,
    outputTokens,
    totalTokens,
  }
}

function nonNegativeInt(value: unknown): number {
  const n = typeof value === 'number' ? value : 0
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.trunc(n))
}
