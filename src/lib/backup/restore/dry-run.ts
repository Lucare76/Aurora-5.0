import { calculateRecordCounts } from '../record-counts'
import { validateBackupRelationships } from '../relationship-validation'

import { checkAccountEmpty } from './account-empty-check'
import { buildAccountingPreview } from './accounting-preview'
import { detectRestoreCollisions } from './collision-detection'
import { buildIdMapping } from './id-mapping'
import { buildRestorePlan } from './restore-order'
import { validateRestoreTransfers } from './transfer-validation'
import type { DryRunInput, DryRunIssue, DryRunResult, MissingReference, RestoreReadiness } from './types'

export function runRestoreDryRun(input: DryRunInput): DryRunResult {
  const options = input.options ?? { mode: 'empty_account_restore' }
  const issues: DryRunIssue[] = []
  const accountEmpty = checkAccountEmpty(input.snapshot)
  const idMapping = buildIdMapping(input.backup, input.snapshot)
  const { collisions, logicalDuplicates } = detectRestoreCollisions(input.backup, input.snapshot)
  const relationshipIssues = validateBackupRelationships(input.backup).map(toDryRunIssue)
  const transferValidation = validateRestoreTransfers(input.backup)
  const accounting = buildAccountingPreview(input.backup)

  issues.push(...input.inspectionIssues.map(toDryRunIssue))
  issues.push(...relationshipIssues)
  issues.push(...transferValidation.issues)
  issues.push(...accounting.issues)

  if (!accountEmpty.isEmpty) {
    issues.push({
      code: 'CURRENT_ACCOUNT_NOT_EMPTY',
      severity: 'error',
      path: ['currentState'],
      message: 'L account contiene gia dati applicativi.',
      details: { collections: accountEmpty.blockingCollections.length },
    })
  }

  for (const collision of collisions) {
    issues.push({
      code: collision.blocking ? 'RESTORE_ID_COLLISION' : 'RESTORE_DUPLICATE',
      severity: collision.blocking ? 'error' : 'warning',
      path: ['collisions', collision.collection],
      message: collision.message,
    })
  }

  for (const duplicate of logicalDuplicates) {
    issues.push({
      code: 'RESTORE_LOGICAL_DUPLICATE',
      severity: duplicate.blocking ? 'error' : 'warning',
      path: ['duplicates', duplicate.collection],
      message: duplicate.message,
    })
  }

  const missingReferences: MissingReference[] = relationshipIssues
    .filter((issue) => issue.severity === 'error' && issue.code.includes('MISSING'))
    .map((issue) => ({
      collection: collectionFromPath(issue.path[0]),
      id: String(issue.path[1] ?? ''),
      reference: String(issue.path.at(-1) ?? ''),
      code: issue.code,
      message: issue.message,
    }))

  const restorePlan = buildRestorePlan(input.backup, issues)
  const blockingErrors = issues.filter((issue) => issue.severity === 'error').length
  const warnings = issues.filter((issue) => issue.severity === 'warning').length
  const readiness = determineReadiness(blockingErrors, warnings)
  const recordCounts = calculateRecordCounts(input.backup)
  const backupRecords = Object.values(recordCounts).reduce((sum, count) => sum + count, 0)

  return {
    mode: options.mode,
    readiness,
    backup: {
      format: input.backup.format,
      schemaVersion: input.backup.schemaVersion,
      createdAt: input.backup.createdAt,
      checksumValid: input.inspectionIssues.some((issue) => issue.code === 'CHECKSUM_VALID'),
    },
    currentState: accountEmpty,
    summary: {
      backupRecords,
      creatableRecords: readiness === 'blocked' ? 0 : backupRecords,
      collisions: collisions.length,
      duplicates: logicalDuplicates.length,
      missingReferences: missingReferences.length,
      blockingErrors,
      warnings,
    },
    idMapping,
    collisions,
    logicalDuplicates,
    missingReferences,
    accountingPreview: {
      ...accounting.preview,
      transfersNeutral: transferValidation.transfersNeutral,
    },
    transferValidation,
    restorePlan: restorePlan.steps,
    issues,
  }
}

function determineReadiness(blockingErrors: number, warnings: number): RestoreReadiness {
  if (blockingErrors > 0) return 'blocked'
  if (warnings > 0) return 'ready_with_warnings'
  return 'ready'
}

function toDryRunIssue(issue: { code: string; severity: string; path: Array<string | number>; message: string; details?: Record<string, string | number | boolean | null> }): DryRunIssue {
  return {
    code: issue.code,
    severity: issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info',
    path: issue.path,
    message: issue.message,
    details: issue.details,
  }
}

function collectionFromPath(path: string | number | undefined): MissingReference['collection'] {
  if (path === 'transactions') return 'transactions'
  if (path === 'categories') return 'categories'
  if (path === 'budgets') return 'budgets'
  if (path === 'recurringRules') return 'recurringRules'
  if (path === 'loanPayments') return 'loanPayments'
  if (path === 'birthdayReminderLog') return 'birthdayReminderLog'
  return 'accounts'
}
