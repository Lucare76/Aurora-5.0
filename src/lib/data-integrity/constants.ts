import type { DataIntegrityCategory, DataIntegritySeverity, DataIntegrityStatus } from './types'

export const DATA_INTEGRITY_RULESET_VERSION = '2026.07.15'
export const DATA_INTEGRITY_MAX_TRANSACTIONS = 100_000
export const DATA_INTEGRITY_MAX_ISSUES_PER_SCAN = 2_000
export const DATA_INTEGRITY_CENT_TOLERANCE = 0.01

export const DATA_INTEGRITY_SEVERITY_PRIORITY: Record<DataIntegritySeverity, number> = {
  CRITICAL: 3,
  WARNING: 2,
  INFO: 1,
}

export const DATA_INTEGRITY_STATUS_PRIORITY: Record<DataIntegrityStatus, number> = {
  open: 5,
  acknowledged: 4,
  ignored: 3,
  stale: 2,
  resolved: 1,
}

export const DATA_INTEGRITY_CATEGORY_LABELS: Record<DataIntegrityCategory, string> = {
  transactions: 'Transazioni',
  transfers: 'Giroconti',
  balances: 'Saldi',
  recurring: 'Ricorrenze',
  loans: 'Prestiti',
  budgets: 'Budget',
  goals: 'Obiettivi',
  categories: 'Categorie',
  references: 'Riferimenti',
  financial_health: 'Salute finanziaria',
  notifications: 'Avvisi',
  temporal: 'Coerenza temporale',
  backup: 'Backup',
}
