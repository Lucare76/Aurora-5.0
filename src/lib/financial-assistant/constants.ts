import type { FinancialAssistantIntent } from './types'

export const FINANCIAL_ASSISTANT_ENGINE_VERSION = '29.0.0'
export const FINANCIAL_ASSISTANT_FEATURE_FLAG = 'FINANCIAL_ASSISTANT_ENABLED'
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000
export const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 20
export const MAX_ASSISTANT_MESSAGE_LENGTH = 1_000
export const MAX_CONTEXT_TRANSACTIONS = 500

export const READ_ONLY_OPERATIONS = ['select', 'explain', 'summarize', 'calculate'] as const
export const FORBIDDEN_WRITE_OPERATIONS = [
  'insert',
  'update',
  'delete',
  'upsert',
  'rpc_write',
  'create_transaction',
  'adjust_account_balance',
  'send_notification',
] as const

export const NAVIGATION_BY_INTENT: Partial<Record<FinancialAssistantIntent, { label: string; href: string }>> = {
  'personal.financial_summary': { label: 'Apri Dashboard', href: '/' },
  'personal.income_expense_summary': { label: 'Apri movimenti', href: '/transactions' },
  'personal.spending_by_category': { label: 'Apri report', href: '/reports' },
  'personal.budget_summary': { label: 'Apri budget', href: '/budgets' },
  'personal.goal_summary': { label: 'Apri obiettivi', href: '/goals' },
  'personal.financial_health_explanation': { label: 'Apri salute finanziaria', href: '/financial-health' },
  'aurora.savings_summary': { label: 'Apri Aurora', href: '/aurora' },
  'adi.summary': { label: 'Apri ADI', href: '/adi' },
}

