export class FinancialAssistantProviderError extends Error {
  constructor(
    message: string,
    readonly code: 'UNAVAILABLE' | 'TIMEOUT' | 'INVALID_OUTPUT' | 'REQUEST_FAILED',
  ) {
    super(message)
    this.name = 'FinancialAssistantProviderError'
  }
}
