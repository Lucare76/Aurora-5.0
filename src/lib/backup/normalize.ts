import { BACKUP_COLLECTION_KEYS } from './constants'
import type { AuroraBackupV1 } from './types'

export function normalizeAuroraBackup(backup: AuroraBackupV1): AuroraBackupV1 {
  return deepSort({
    ...backup,
    createdAt: new Date(backup.createdAt).toISOString(),
    data: {
      ...backup.data,
      accounts: sortById(backup.data.accounts),
      categories: sortById(backup.data.categories),
      transactions: sortById(backup.data.transactions),
      budgets: sortById(backup.data.budgets),
      recurringRules: sortById(backup.data.recurringRules),
      loans: sortById(backup.data.loans),
      loanPayments: sortById(backup.data.loanPayments),
      birthdays: sortById(backup.data.birthdays),
      birthdayReminderLog: sortById(backup.data.birthdayReminderLog),
      auditLogs: sortById(backup.data.auditLogs),
    },
  }) as AuroraBackupV1
}

function sortById<T extends { id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id))
}

export function stripChecksum(backup: AuroraBackupV1): AuroraBackupV1 {
  const normalized = normalizeAuroraBackup(backup)
  return {
    ...normalized,
    integrity: {
      ...normalized.integrity,
      checksum: null,
    },
  }
}

export function emptyRecordCounts(): Record<(typeof BACKUP_COLLECTION_KEYS)[number], number> {
  return Object.fromEntries(BACKUP_COLLECTION_KEYS.map((key) => [key, 0])) as Record<(typeof BACKUP_COLLECTION_KEYS)[number], number>
}

function deepSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepSort)
  if (!value || typeof value !== 'object') return value

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = deepSort((value as Record<string, unknown>)[key])
      return result
    }, {})
}
