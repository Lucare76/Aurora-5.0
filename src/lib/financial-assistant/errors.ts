import type { FinancialAssistantStatus } from './types'

export class FinancialAssistantError extends Error {
  constructor(
    public readonly code: FinancialAssistantStatus,
    message: string,
    public readonly httpStatus = 400,
  ) {
    super(message)
    this.name = 'FinancialAssistantError'
  }
}

export function safeAssistantErrorMessage(error: unknown): string {
  if (error instanceof FinancialAssistantError) return error.message
  if (process.env.NODE_ENV !== 'production' && error instanceof Error) return error.message
  return 'Non riesco a completare questa richiesta in modo sicuro.'
}

