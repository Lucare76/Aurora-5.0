export type AiPricingProvider = 'OPENAI' | 'ANTHROPIC' | 'GEMINI'
export type AiPricingCurrency = 'USD'

export type AiModelPricing = {
  provider: AiPricingProvider
  model: string
  inputPerMillionTokens: number
  outputPerMillionTokens: number
  currency: AiPricingCurrency
  validFrom: string
  sourceLabel: string
  sourceUrl: string
  lastReviewedAt: string
}

export type AIRequestCost = {
  inputCost: number | null
  outputCost: number | null
  totalCost: number | null
  currency: AiPricingCurrency
  pricingFound: boolean
}
