import type { AiPricingProvider } from '../pricing/types'

export type AIUsageRecord = {
  provider: AiPricingProvider
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export type AiUsageSummary = {
  requestCount: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCost: number | null
  currency: 'USD'
  providers: string[]
  models: string[]
  lastRequestAt: string | null
}

export type AiUsageApiResponse = {
  today: AiUsageSummary
  currentMonth: AiUsageSummary
  pricingNote: string
}
