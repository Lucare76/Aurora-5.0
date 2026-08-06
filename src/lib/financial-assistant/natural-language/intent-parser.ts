import { assistantIntentPatterns } from './patterns'
import { parseItalianAmount } from './amount-parser'
import { containsUnsafeInstruction, containsWriteRequest, normalizeAssistantMessage } from './normalize'
import { parseItalianPeriod, periodKey } from './period-parser'
import { defaultAssistantSuggestions } from './examples'
import type { FinancialAssistantScope } from '../types'
import type { ParsedAssistantMessage, ParserConfidence } from './types'

function lowerConfidence(current: ParserConfidence): ParserConfidence {
  return current === 'HIGH' ? 'MEDIUM' : current
}

export function parseNaturalLanguageMessage(message: string, requestedScope: FinancialAssistantScope = 'PERSONAL'): ParsedAssistantMessage {
  const normalizedMessage = normalizeAssistantMessage(message)
  if (!normalizedMessage) {
    return {
      confidence: 'LOW',
      supported: false,
      reason: 'Messaggio vuoto.',
      normalizedMessage,
      missingInputs: ['message'],
      suggestions: defaultAssistantSuggestions,
    }
  }

  if (containsUnsafeInstruction(normalizedMessage) || containsWriteRequest(normalizedMessage)) {
    return {
      confidence: 'LOW',
      supported: false,
      reason: 'Aurora è in modalità solo lettura e non può modificare dati o autorizzazioni.',
      normalizedMessage,
      missingInputs: [],
      suggestions: defaultAssistantSuggestions,
    }
  }

  const pattern = assistantIntentPatterns.find((candidate) => candidate.patterns.some((regex) => regex.test(normalizedMessage)))
  if (!pattern) {
    return {
      confidence: 'LOW',
      supported: false,
      reason: 'Domanda non supportata da questa versione deterministica.',
      normalizedMessage,
      missingInputs: [],
      suggestions: defaultAssistantSuggestions,
    }
  }

  const amount = parseItalianAmount(normalizedMessage)
  const period = parseItalianPeriod(normalizedMessage)
  const missingInputs = pattern.needsAmount && !amount ? ['price'] : []
  const confidence = period.ambiguous || missingInputs.length > 0 ? lowerConfidence(pattern.confidence) : pattern.confidence
  const scope = pattern.scope ?? requestedScope
  const parameters: Record<string, unknown> = {}
  if (amount) parameters.price = amount

  return {
    confidence,
    supported: true,
    normalizedMessage,
    query: {
      intent: pattern.intent,
      scope,
      message,
      period: periodKey(period),
      parameters,
    },
    period,
    amount: amount ?? undefined,
    missingInputs,
    suggestions: defaultAssistantSuggestions,
  }
}
