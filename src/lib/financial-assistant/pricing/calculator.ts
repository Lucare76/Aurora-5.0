import { findAiPricing } from './registry'
import type { AIRequestCost, AiPricingProvider } from './types'

export function calculateAiRequestCost(params: {
  provider: AiPricingProvider
  model: string
  inputTokens: number
  outputTokens: number
}): AIRequestCost {
  const pricing = findAiPricing(params.provider, params.model)
  if (!pricing) {
    return {
      inputCost: null,
      outputCost: null,
      totalCost: null,
      currency: 'USD',
      pricingFound: false,
    }
  }

  const inputTokens = Math.max(0, Math.trunc(params.inputTokens))
  const outputTokens = Math.max(0, Math.trunc(params.outputTokens))
  const inputCost = roundUsd((inputTokens / 1_000_000) * pricing.inputPerMillionTokens)
  const outputCost = roundUsd((outputTokens / 1_000_000) * pricing.outputPerMillionTokens)
  return {
    inputCost,
    outputCost,
    totalCost: roundUsd(inputCost + outputCost),
    currency: pricing.currency,
    pricingFound: true,
  }
}

function roundUsd(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000
}
