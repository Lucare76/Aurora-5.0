import type { AssistantQuery, FinancialAssistantIntent, FinancialAssistantPeriod, FinancialAssistantScope } from '../types'

export type ParserConfidence = 'HIGH' | 'MEDIUM' | 'LOW'

export type ParsedPeriod = {
  key: FinancialAssistantPeriod
  label: string
  ambiguous?: boolean
}

export type ParsedAssistantMessage = {
  confidence: ParserConfidence
  supported: boolean
  reason?: string
  normalizedMessage: string
  query?: AssistantQuery
  period?: ParsedPeriod
  amount?: number
  missingInputs: string[]
  suggestions: string[]
}

export type IntentPattern = {
  intent: FinancialAssistantIntent
  scope?: FinancialAssistantScope
  confidence: ParserConfidence
  patterns: RegExp[]
  needsAmount?: boolean
}
