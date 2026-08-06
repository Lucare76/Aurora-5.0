import { FinancialAssistantError } from '../errors'

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous/i,
  /disattiva\s+(le\s+)?regole/i,
  /mostra\s+.*(secret|token|cookie|service role)/i,
  /esegui\s+(sql|rpc|update|delete|insert)/i,
  /modifica\s+(conto|movimento|transazione|saldo)/i,
]

export function assertNoPromptInjection(message?: string): void {
  if (!message) return
  if (INJECTION_PATTERNS.some((pattern) => pattern.test(message))) {
    throw new FinancialAssistantError('FORBIDDEN', 'Posso solo analizzare dati finanziari in sola lettura.', 403)
  }
}

