import { BACKUP_COLLECTION_KEYS } from './constants'
import { issue } from './issue'
import type { AuroraBackupRecordCounts, AuroraBackupV1, BackupValidationIssue } from './types'

export function calculateRecordCounts(backup: Pick<AuroraBackupV1, 'data'>): AuroraBackupRecordCounts {
  return {
    accounts: backup.data.accounts.length,
    categories: backup.data.categories.length,
    transactions: backup.data.transactions.length,
    budgets: backup.data.budgets.length,
    recurringRules: backup.data.recurringRules.length,
    loans: backup.data.loans.length,
    loanPayments: backup.data.loanPayments.length,
    birthdays: backup.data.birthdays.length,
    birthdayReminderLog: backup.data.birthdayReminderLog.length,
    auditLogs: backup.data.auditLogs.length,
  }
}

export function validateRecordCounts(backup: AuroraBackupV1): BackupValidationIssue[] {
  const issues: BackupValidationIssue[] = []
  const actual = calculateRecordCounts(backup)
  const declared = backup.integrity.recordCounts

  for (const key of BACKUP_COLLECTION_KEYS) {
    if (!(key in declared)) {
      issues.push(issue('RECORD_COUNT_MISSING', 'error', ['integrity', 'recordCounts', key], 'Conteggio record mancante.', { collection: key }))
      continue
    }
    if (declared[key] !== actual[key]) {
      issues.push(issue(
        'RECORD_COUNT_MISMATCH',
        'error',
        ['integrity', 'recordCounts', key],
        'Conteggio record non corrispondente.',
        { collection: key, expected: actual[key], actual: declared[key] ?? -1 },
      ))
    }
  }

  for (const key of Object.keys(declared)) {
    if (!(BACKUP_COLLECTION_KEYS as readonly string[]).includes(key)) {
      issues.push(issue('UNKNOWN_RECORD_COUNT', 'warning', ['integrity', 'recordCounts', key], 'Conteggio per collezione non riconosciuta.', { collection: key }))
    }
  }

  return issues
}
