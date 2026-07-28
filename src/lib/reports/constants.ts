export const REPORT_ENGINE_VERSION = '1.0.0'
export const REPORT_SCHEMA_VERSION = 1
export const REPORT_REGISTRY_VERSION = '1.0.0'
export const REPORT_EXPORT_VERSION = '1.0.0'

export const REPORT_TYPE_CODES = [
  'MONTHLY',
  'QUARTERLY',
  'ANNUAL',
  'CUSTOM',
  'INCOME',
  'EXPENSES',
  'CASH_FLOW',
  'ACCOUNTS',
  'NET_WORTH',
  'BUDGETS',
  'GOALS',
  'LOANS',
  'RECURRING',
  'FINANCIAL_HEALTH',
  'DATA_INTEGRITY',
  'SCENARIOS',
  'TRANSACTIONS',
  'CATEGORIES',
  'TAGS',
] as const

export type ReportTypeCode = (typeof REPORT_TYPE_CODES)[number]
