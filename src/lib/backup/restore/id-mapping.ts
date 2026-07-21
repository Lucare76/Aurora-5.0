import type { AuroraBackupRecordCounts, AuroraBackupV1 } from '../types'
import type { CurrentUserDataSnapshot, IdMapping } from './types'

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

export function buildIdMapping(backup: AuroraBackupV1, snapshot: CurrentUserDataSnapshot): IdMapping[] {
  // Default categories will be deleted by the RPC before backup categories are
  // inserted. Their UUIDs are therefore not real collisions — the backup UUID is
  // preserved unchanged in the database after the restore.
  const defaultCategoryIds = new Set(
    snapshot.categories.filter((c) => c.is_default === true).map((c) => c.id),
  )

  const snapshotIds = new Set<string>()
  for (const collection of COLLECTIONS) {
    for (const record of snapshot[collection]) snapshotIds.add(record.id)
  }

  return COLLECTIONS.flatMap((collection) =>
    backup.data[collection].map((record) => {
      const hasConflict = snapshotIds.has(record.id)
      const isReconciledDefault = collection === 'categories' && defaultCategoryIds.has(record.id)
      const collided = hasConflict && !isReconciledDefault
      return {
        collection,
        oldId: record.id,
        proposedId: record.id,
        strategy: collided ? 'blocked' : 'preserve',
        reason: isReconciledDefault
          ? 'Categoria predefinita equivalente: UUID preservato dopo rimozione automatica dalla RPC'
          : collided
          ? 'Collisione UUID con dati esistenti nello snapshot corrente'
          : 'Account vuoto e nessuna collisione: ID originale preservato',
      } satisfies IdMapping
    }),
  )
}
