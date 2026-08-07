import type { AssistantResult } from '../types'
import type { AiIntentClassificationInput, AiResponseCompositionInput } from './types'

const forbiddenPatterns = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  /\bservice[_-]?role\b/i,
  /\bsupabase\b/i,
  /\bsql\b/i,
]

export function redactAssistantText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '[id]')
    .slice(0, 4_000)
}

export function assertRedactedPayload(payload: unknown): void {
  const serialized = JSON.stringify(payload)
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(serialized)) {
      throw new Error('Payload AI contiene dati non consentiti.')
    }
  }
}

export function buildAiClassificationPayload(input: AiIntentClassificationInput): AiIntentClassificationInput {
  const payload = {
    ...input,
    message: redactAssistantText(input.message),
    allowedIntents: input.allowedIntents.map((item) => ({
      intent: item.intent,
      scope: item.scope,
      label: item.label,
      description: item.description,
    })),
  }
  assertRedactedPayload(payload)
  return payload
}

export function buildAllowedFacts(result: AssistantResult): string[] {
  const facts = [
    `status: ${result.status}`,
    `intent: ${result.intent ?? 'nessuno'}`,
    `scope: ${result.scope ?? 'nessuno'}`,
    `answer: ${result.answer}`,
    ...result.summary.map((item) => `summary: ${item}`),
    ...result.insights.map((item) => `insight: ${item.title} - ${item.detail}`),
    ...result.evidence.map((item) => `evidence: ${item.metric} = ${String(item.value)} ${item.unit ?? ''}`.trim()),
    ...result.warnings.map((item) => `warning: ${item}`),
  ]
  return facts.map(redactAssistantText).slice(0, 40)
}

export function buildAiCompositionPayload(message: string, result: AssistantResult): AiResponseCompositionInput {
  const payload = {
    message: redactAssistantText(message),
    result: {
      ...result,
      citations: result.citations.map((citation) => ({
        ...citation,
        id: citation.id,
        label: citation.label,
        table: citation.table,
        fields: citation.fields,
        rowCount: citation.rowCount,
        filteredBy: citation.filteredBy,
      })),
    },
    allowedFacts: buildAllowedFacts(result),
  }
  assertRedactedPayload(payload)
  return payload
}
