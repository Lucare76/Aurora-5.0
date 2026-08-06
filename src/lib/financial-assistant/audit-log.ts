import type { FinancialAssistantIntent, FinancialAssistantScope, FinancialAssistantStatus } from './types'
import { hashIdentifier, sanitizeAuditPayload } from './redaction'

export function logAssistantAudit(event: {
  userId: string
  intent?: FinancialAssistantIntent | null
  scope?: FinancialAssistantScope | null
  status: FinancialAssistantStatus
  message?: string
}): void {
  const payload = sanitizeAuditPayload({
    component: 'financial-assistant',
    user: hashIdentifier(event.userId),
    intent: event.intent ?? null,
    scope: event.scope ?? null,
    status: event.status,
    message: event.message ?? '',
  })

  if (event.status === 'OK' || event.status === 'NEEDS_INPUT') {
    console.info('[financial-assistant]', payload)
  } else {
    console.warn('[financial-assistant]', payload)
  }
}

