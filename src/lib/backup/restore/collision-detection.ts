import type { AuroraBackupRecordCounts, AuroraBackupV1 } from '../types'
import type { CurrentUserDataSnapshot, IdCollision, LogicalDuplicate } from './types'

const COLLECTIONS: Array<keyof AuroraBackupRecordCounts> = [
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
]

export function detectRestoreCollisions(
  backup: AuroraBackupV1,
  snapshot: CurrentUserDataSnapshot,
): { collisions: IdCollision[]; logicalDuplicates: LogicalDuplicate[] } {
  const collisions: IdCollision[] = []
  const logicalDuplicates: LogicalDuplicate[] = []

  for (const collection of COLLECTIONS) {
    const currentIds = new Set(snapshot[collection].map((record) => record.id))
    const seen = new Set<string>()

    for (const record of backup.data[collection]) {
      if (seen.has(record.id)) {
        collisions.push({
          collection,
          id: record.id,
          kind: 'id_collision',
          blocking: true,
          message: 'UUID duplicato all interno del file backup.',
        })
      }
      seen.add(record.id)

      if (currentIds.has(record.id)) {
        collisions.push({
          collection,
          id: record.id,
          kind: 'id_collision',
          blocking: true,
          message: 'UUID gia presente nello stato corrente.',
        })
      }
    }
  }

  detectLogicalAccountDuplicates(backup, snapshot, logicalDuplicates)
  detectLogicalCategoryDuplicates(backup, snapshot, logicalDuplicates)
  detectLogicalTransactionDuplicates(backup, snapshot, logicalDuplicates)
  detectLogicalLoanPaymentDuplicates(backup, snapshot, logicalDuplicates)
  detectLogicalBirthdayDuplicates(backup, snapshot, logicalDuplicates)
  detectLogicalReminderDuplicates(backup, snapshot, logicalDuplicates)

  return { collisions, logicalDuplicates }
}

function detectLogicalAccountDuplicates(
  backup: AuroraBackupV1,
  snapshot: CurrentUserDataSnapshot,
  out: LogicalDuplicate[],
) {
  const keys = new Set(snapshot.accounts.map((account) => `${normalize(account.name)}:${account.type ?? ''}`))
  for (const account of backup.data.accounts) {
    const key = `${normalize(account.name)}:${account.type}`
    if (keys.has(key)) {
      out.push({
        collection: 'accounts',
        key,
        blocking: true,
        message: 'Conto con stessa chiave logica gia presente.',
      })
    }
  }
}

function detectLogicalCategoryDuplicates(
  backup: AuroraBackupV1,
  snapshot: CurrentUserDataSnapshot,
  out: LogicalDuplicate[],
) {
  const keys = new Set(snapshot.categories.map((category) => `${category.parent_id ?? 'root'}:${normalize(category.name)}:${category.type ?? ''}`))
  for (const category of backup.data.categories) {
    const key = `${category.parent_id ?? 'root'}:${normalize(category.name)}:${category.type}`
    if (keys.has(key)) {
      out.push({
        collection: 'categories',
        key,
        blocking: true,
        message: 'Categoria con stessa chiave logica gia presente.',
      })
    }
  }
}

function detectLogicalTransactionDuplicates(
  backup: AuroraBackupV1,
  snapshot: CurrentUserDataSnapshot,
  out: LogicalDuplicate[],
) {
  const keys = new Set(snapshot.transactions.map((tx) => `${tx.date}:${tx.account_id}:${tx.category_id ?? ''}:${tx.amount ?? 0}`))
  for (const tx of backup.data.transactions) {
    const key = `${tx.date}:${tx.account_id}:${tx.category_id ?? ''}:${tx.amount}`
    if (keys.has(key)) {
      out.push({
        collection: 'transactions',
        key,
        blocking: true,
        message: 'Movimento con fingerprint equivalente gia presente.',
      })
    }
  }
}

function detectLogicalLoanPaymentDuplicates(
  backup: AuroraBackupV1,
  snapshot: CurrentUserDataSnapshot,
  out: LogicalDuplicate[],
) {
  const keys = new Set(snapshot.loanPayments.map((payment) => `${payment.loan_id}:${payment.date ?? ''}:${payment.amount ?? 0}`))
  for (const payment of backup.data.loanPayments) {
    const key = `${payment.loan_id}:${payment.paid_at}:${payment.amount}`
    if (keys.has(key)) {
      out.push({
        collection: 'loanPayments',
        key,
        blocking: true,
        message: 'Pagamento prestito equivalente gia presente.',
      })
    }
  }
}

function detectLogicalBirthdayDuplicates(
  backup: AuroraBackupV1,
  snapshot: CurrentUserDataSnapshot,
  out: LogicalDuplicate[],
) {
  const keys = new Set(snapshot.birthdays.map((birthday) => `${normalize(birthday.name)}:${birthday.date ?? ''}`))
  for (const birthday of backup.data.birthdays) {
    const key = `${normalize(birthday.name)}:${birthday.birth_date}`
    if (keys.has(key)) {
      out.push({
        collection: 'birthdays',
        key,
        blocking: true,
        message: 'Compleanno equivalente gia presente.',
      })
    }
  }
}

function detectLogicalReminderDuplicates(
  backup: AuroraBackupV1,
  snapshot: CurrentUserDataSnapshot,
  out: LogicalDuplicate[],
) {
  const keys = new Set(snapshot.birthdayReminderLog.map((log) => `${log.birthday_id}:${log.year ?? 0}:${log.days_before ?? 0}`))
  for (const log of backup.data.birthdayReminderLog) {
    const key = `${log.birthday_id}:${log.year}:${log.days_before}`
    if (keys.has(key)) {
      out.push({
        collection: 'birthdayReminderLog',
        key,
        blocking: true,
        message: 'Reminder compleanno equivalente gia presente.',
      })
    }
  }
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}
