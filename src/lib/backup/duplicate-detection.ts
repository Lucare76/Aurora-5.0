import { canonicalizeValue } from './canonicalize'
import { issue } from './issue'
import type { AuroraBackupV1, BackupValidationIssue } from './types'

type CollectionName = keyof AuroraBackupV1['data']

const COLLECTIONS: CollectionName[] = [
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

export function detectBackupDuplicates(backup: AuroraBackupV1): BackupValidationIssue[] {
  const issues: BackupValidationIssue[] = []
  for (const collection of COLLECTIONS) {
    const seen = new Map<string, string>()
    const rows = backup.data[collection] as Array<{ id: string; name?: string; type?: string; parent_id?: string | null }>
    rows.forEach((row, index) => {
      const currentHash = canonicalizeValue(row)
      const previousHash = seen.get(row.id)
      if (previousHash === undefined) {
        seen.set(row.id, currentHash)
      } else if (previousHash === currentHash) {
        issues.push(issue('DUPLICATE_ID_IDENTICAL', 'warning', ['data', collection, index], 'Record duplicato identico.', { collection, id: row.id }))
      } else {
        issues.push(issue('DUPLICATE_ID_CONFLICT', 'error', ['data', collection, index], 'Stesso ID con contenuto differente.', { collection, id: row.id }))
      }
    })
  }

  const categoryKeys = new Map<string, string>()
  backup.data.categories.forEach((category, index) => {
    const key = `${category.parent_id ?? 'root'}:${category.type}:${category.name.trim().toLowerCase()}`
    const previous = categoryKeys.get(key)
    if (previous && previous !== category.id) {
      issues.push(issue('DUPLICATE_CATEGORY_LOGICAL_KEY', 'warning', ['data', 'categories', index], 'Categoria con stessa chiave logica.', { id: category.id }))
    }
    categoryKeys.set(key, category.id)
  })

  return issues
}
