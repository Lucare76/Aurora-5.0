import type { ReportTypeCode } from './constants'

const TYPE_LABELS: Partial<Record<ReportTypeCode, string>> = {
  MONTHLY: 'mensile',
  QUARTERLY: 'trimestrale',
  ANNUAL: 'annuale',
  CUSTOM: 'personalizzato',
  INCOME: 'entrate',
  EXPENSES: 'uscite',
  CASH_FLOW: 'cashflow',
  ACCOUNTS: 'conti',
  NET_WORTH: 'patrimonio',
  BUDGETS: 'budget',
  GOALS: 'obiettivi',
  LOANS: 'prestiti',
  RECURRING: 'ricorrenti',
  FINANCIAL_HEALTH: 'salute-finanziaria',
  DATA_INTEGRITY: 'integrita-dati',
  SCENARIOS: 'scenari',
  TRANSACTIONS: 'movimenti',
  CATEGORIES: 'categorie',
  TAGS: 'tag',
}

export function buildReportFilename(
  from: string,
  to: string,
  type: ReportTypeCode | null,
  extension: 'csv' | 'xlsx',
): string {
  const typeLabel = type ? (TYPE_LABELS[type] ?? type.toLowerCase()) : 'report'
  return `aurora-${typeLabel}-${from}-${to}.${extension}`
}
