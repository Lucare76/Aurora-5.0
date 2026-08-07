import type { AiModelPricing, AiPricingProvider } from './types'

const reviewedAt = '2026-08-07'

export const AI_PRICING_REGISTRY: AiModelPricing[] = [
  {
    provider: 'OPENAI',
    model: 'gpt-4.1-mini',
    inputPerMillionTokens: 0.40,
    outputPerMillionTokens: 1.60,
    currency: 'USD',
    validFrom: '2025-04-14',
    sourceLabel: 'OpenAI model pricing - GPT-4.1 mini',
    sourceUrl: 'https://developers.openai.com/api/docs/models/gpt-4.1-mini',
    lastReviewedAt: reviewedAt,
  },
  {
    provider: 'OPENAI',
    model: 'gpt-4.1-mini-2025-04-14',
    inputPerMillionTokens: 0.40,
    outputPerMillionTokens: 1.60,
    currency: 'USD',
    validFrom: '2025-04-14',
    sourceLabel: 'OpenAI model pricing - GPT-4.1 mini',
    sourceUrl: 'https://developers.openai.com/api/docs/models/gpt-4.1-mini',
    lastReviewedAt: reviewedAt,
  },
  {
    provider: 'OPENAI',
    model: 'gpt-5-mini',
    inputPerMillionTokens: 0.25,
    outputPerMillionTokens: 2.00,
    currency: 'USD',
    validFrom: '2025-08-07',
    sourceLabel: 'OpenAI model pricing - GPT-5 mini',
    sourceUrl: 'https://developers.openai.com/api/docs/models/gpt-5-mini',
    lastReviewedAt: reviewedAt,
  },
  {
    provider: 'OPENAI',
    model: 'gpt-5-mini-2025-08-07',
    inputPerMillionTokens: 0.25,
    outputPerMillionTokens: 2.00,
    currency: 'USD',
    validFrom: '2025-08-07',
    sourceLabel: 'OpenAI model pricing - GPT-5 mini',
    sourceUrl: 'https://developers.openai.com/api/docs/models/gpt-5-mini',
    lastReviewedAt: reviewedAt,
  },
]

export function findAiPricing(provider: AiPricingProvider, model: string): AiModelPricing | null {
  const normalized = model.trim().toLowerCase()
  return AI_PRICING_REGISTRY.find((entry) =>
    entry.provider === provider && entry.model.toLowerCase() === normalized
  ) ?? null
}
