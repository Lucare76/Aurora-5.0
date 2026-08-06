import { canAccessPrivateFinance, isPrivateFinanceConfigured } from '@/lib/access/private-finance-access'
import { FinancialAssistantError } from './errors'
import type { FinancialAssistantIntent, FinancialAssistantScope } from './types'

const PRIVATE_INTENTS = new Set<FinancialAssistantIntent>(['aurora.savings_summary', 'adi.summary'])

export function isFinancialAssistantEnabled(): boolean {
  return process.env.FINANCIAL_ASSISTANT_ENABLED === 'true'
}

export function getAllowedScopes(email?: string | null): FinancialAssistantScope[] {
  const scopes: FinancialAssistantScope[] = ['PERSONAL']
  if (isPrivateFinanceConfigured() && canAccessPrivateFinance(email)) scopes.push('AURORA', 'ADI')
  return scopes
}

export function defaultScopeForIntent(intent: FinancialAssistantIntent): FinancialAssistantScope {
  if (intent === 'aurora.savings_summary') return 'AURORA'
  if (intent === 'adi.summary') return 'ADI'
  return 'PERSONAL'
}

export function assertScopeAllowed(params: {
  email?: string | null
  intent: FinancialAssistantIntent
  requestedScope?: FinancialAssistantScope
}): FinancialAssistantScope {
  const scope = params.requestedScope ?? defaultScopeForIntent(params.intent)
  if (PRIVATE_INTENTS.has(params.intent) && scope === 'PERSONAL') {
    throw new FinancialAssistantError('INVALID_REQUEST', 'La richiesta usa uno scope non coerente con lo strumento selezionato.', 400)
  }
  if (!getAllowedScopes(params.email).includes(scope)) {
    throw new FinancialAssistantError('FORBIDDEN', 'Questa sezione privata non e disponibile per il tuo account.', 403)
  }
  if ((params.intent === 'aurora.savings_summary' && scope !== 'AURORA') || (params.intent === 'adi.summary' && scope !== 'ADI')) {
    throw new FinancialAssistantError('INVALID_REQUEST', 'La richiesta usa uno scope non coerente con lo strumento selezionato.', 400)
  }
  if (!PRIVATE_INTENTS.has(params.intent) && scope !== 'PERSONAL') {
    throw new FinancialAssistantError('FORBIDDEN', 'Gli strumenti personali non possono leggere aree private.', 403)
  }
  return scope
}

