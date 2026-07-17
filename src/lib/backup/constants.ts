export const AURORA_BACKUP_FORMAT = 'aurora-backup'
export const AURORA_BACKUP_SCHEMA_VERSION = 1
export const SUPPORTED_AURORA_BACKUP_SCHEMA_VERSIONS = [AURORA_BACKUP_SCHEMA_VERSION] as const

export const BACKUP_LIMITS = {
  maxRecordsPerCollection: 100_000,
  maxStringLength: 2_000,
  maxDescriptionLength: 500,
  maxNotesLength: 5_000,
  maxLogicalCollections: 20,
} as const

export const BACKUP_COLLECTION_KEYS = [
  'accounts',
  'categories',
  'transactions',
  'budgets',
  'recurringRules',
  'loans',
  'loanPayments',
  'birthdays',
  'birthdayReminderLog',
  'auditLogs',
] as const

export const DANGEROUS_KEYS = ['__proto__', 'prototype', 'constructor'] as const
