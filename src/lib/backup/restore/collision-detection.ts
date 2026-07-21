import type { AuroraBackupRecordCounts, AuroraBackupV1 } from '../types'
import type { CurrentUserDataSnapshot, DefaultCategoryReconciliation, IdCollision, LogicalDuplicate } from './types'

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
): { collisions: IdCollision[]; logicalDuplicates: LogicalDuplicate[]; reconciledDefaultCategories: DefaultCategoryReconciliation[] } {
  const collisions: IdCollision[] = []
  const logicalDuplicates: LogicalDuplicate[] = []

  // Default category IDs will be deleted by the RPC before backup categories are
  // inserted, so a UUID match against a default category is not a real collision.
  const defaultCategoryIds = new Set(
    snapshot.categories.filter((c) => c.is_default === true).map((c) => c.id),
  )

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
        if (collection === 'categories' && defaultCategoryIds.has(record.id)) {
          // The RPC deletes default categories before inserting from backup → not a real collision.
          continue
        }
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

  const reconciledDefaultCategories: DefaultCategoryReconciliation[] = []
  detectLogicalAccountDuplicates(backup, snapshot, logicalDuplicates)
  detectLogicalCategoryDuplicates(backup, snapshot, logicalDuplicates, reconciledDefaultCategories)
  detectLogicalTransactionDuplicates(backup, snapshot, logicalDuplicates)
  detectLogicalLoanPaymentDuplicates(backup, snapshot, logicalDuplicates)
  detectLogicalBirthdayDuplicates(backup, snapshot, logicalDuplicates)
  detectLogicalReminderDuplicates(backup, snapshot, logicalDuplicates)

  return { collisions, logicalDuplicates, reconciledDefaultCategories }
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
  reconciledOut: DefaultCategoryReconciliation[],
) {
  // Keys for user-created categories — always blocking duplicates.
  const userKeys = new Set(
    snapshot.categories
      .filter((c) => c.is_default !== true)
      .map((c) => `${c.parent_id ?? 'root'}:${normalize(c.name)}:${c.type ?? ''}`),
  )

  // key → [default snapshot categories with that exact key] for 1:1 reconciliation.
  const defaultKeyMap = new Map<string, typeof snapshot.categories>()
  for (const c of snapshot.categories) {
    if (c.is_default === true) {
      const key = `${c.parent_id ?? 'root'}:${normalize(c.name)}:${c.type ?? ''}`
      const bucket = defaultKeyMap.get(key) ?? []
      bucket.push(c)
      defaultKeyMap.set(key, bucket)
    }
  }

  // parentLevel:name → [default snapshot categories] for name+level but type-mismatch check.
  const defaultNameLevelMap = new Map<string, typeof snapshot.categories>()
  for (const c of snapshot.categories) {
    if (c.is_default === true) {
      const nameKey = `${c.parent_id ?? 'root'}:${normalize(c.name)}`
      const bucket = defaultNameLevelMap.get(nameKey) ?? []
      bucket.push(c)
      defaultNameLevelMap.set(nameKey, bucket)
    }
  }

  // Track which default keys have already been claimed (one backup cat per default key).
  const claimedDefaultKeys = new Set<string>()

  for (const category of backup.data.categories) {
    const key = `${category.parent_id ?? 'root'}:${normalize(category.name)}:${category.type}`
    const nameKey = `${category.parent_id ?? 'root'}:${normalize(category.name)}`

    if (userKeys.has(key)) {
      // Exact match against a user-created category → always blocking.
      out.push({
        collection: 'categories',
        key,
        blocking: true,
        message: 'Categoria utente con stessa chiave logica gia presente.',
      })
    } else if (defaultKeyMap.has(key)) {
      const matches = defaultKeyMap.get(key)!
      if (matches.length > 1) {
        // Multiple snapshot defaults share the same key → ambiguous.
        out.push({
          collection: 'categories',
          key,
          blocking: true,
          message: `Ambiguita: ${matches.length} categorie predefinite con chiave identica nel conto corrente.`,
        })
      } else if (claimedDefaultKeys.has(key)) {
        // A previous backup category already claimed this default key → ambiguous.
        out.push({
          collection: 'categories',
          key,
          blocking: true,
          message: 'Ambiguita: piu categorie del backup corrispondono alla stessa categoria predefinita.',
        })
      } else {
        // Exact 1:1 match with a single default → reconciled (non-blocking).
        // The RPC deletes all defaults before inserting backup categories, so
        // the backup category UUID is preserved with no duplicate in the DB.
        claimedDefaultKeys.add(key)
        reconciledOut.push({
          backupCategoryId: category.id,
          key,
          message: 'Categoria predefinita equivalente: sara riutilizzata durante il ripristino.',
        })
      }
    } else if (defaultNameLevelMap.has(nameKey)) {
      // Same name+level but different type → suspicious; block to prevent silent
      // type conversion of an existing default category.
      out.push({
        collection: 'categories',
        key,
        blocking: true,
        message: 'Conflitto di tipo con categoria predefinita: stesso nome ma tipo diverso.',
      })
    }
    // else: no match → new category, no conflict.
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
