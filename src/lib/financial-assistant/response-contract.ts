import { NAVIGATION_BY_INTENT } from './constants'
import type {
  AssistantCitation,
  AssistantEvidence,
  AssistantInsight,
  AssistantResult,
  FinancialAssistantIntent,
  FinancialAssistantScope,
  FinancialAssistantStatus,
  MissingInput,
} from './types'

export function buildAssistantResult(params: {
  status?: FinancialAssistantStatus
  intent: FinancialAssistantIntent | null
  scope: FinancialAssistantScope | null
  answer: string
  summary?: string[]
  insights?: AssistantInsight[]
  evidence?: AssistantEvidence[]
  citations?: AssistantCitation[]
  missingInputs?: MissingInput[]
  warnings?: string[]
  generatedAt?: Date
}): AssistantResult {
  return {
    status: params.status ?? 'OK',
    readOnly: true,
    intent: params.intent,
    scope: params.scope,
    answer: params.answer,
    summary: params.summary ?? [],
    insights: params.insights ?? [],
    evidence: params.evidence ?? [],
    citations: params.citations ?? [],
    missingInputs: params.missingInputs ?? [],
    navigation: params.intent ? NAVIGATION_BY_INTENT[params.intent] : undefined,
    warnings: params.warnings ?? [],
    generatedAt: (params.generatedAt ?? new Date()).toISOString(),
  }
}

export function needsInputResult(params: {
  intent: FinancialAssistantIntent
  scope: FinancialAssistantScope
  answer: string
  missingInputs: MissingInput[]
}): AssistantResult {
  return buildAssistantResult({
    status: 'NEEDS_INPUT',
    intent: params.intent,
    scope: params.scope,
    answer: params.answer,
    missingInputs: params.missingInputs,
  })
}

