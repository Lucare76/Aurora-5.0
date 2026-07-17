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
  const snapshotIds = new Set<string>()
  for (const collection of COLLECTIONS) {
    for (const record of snapshot[collection]) snapshotIds.add(record.id)
  }

  return COLLECTIONS.flatMap((collection) =>
    backup.data[collection].map((record) => {
      const collided = snapshotIds.has(record.id)
      return {
        collection,
        oldId: record.id,
        proposedId: record.id,
        strategy: collided ? 'blocked' : 'preserve',
        reason: collided
          ? 'Collisione UUID con dati esistenti nello snapshot corrente'
          : 'Account vuoto e nessuna collisione: ID originale preservato',
      } satisfies IdMapping
    }),
  )
}
