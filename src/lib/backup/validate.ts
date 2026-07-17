import { z } from 'zod'

import {
  AURORA_BACKUP_FORMAT,
  AURORA_BACKUP_SCHEMA_VERSION,
  SUPPORTED_AURORA_BACKUP_SCHEMA_VERSIONS,
} from './constants'
import { computeBackupChecksum, verifyBackupChecksum } from './checksum'
import { detectBackupDuplicates } from './duplicate-detection'
import { hasErrors, issue } from './issue'
import { normalizeAuroraBackup } from './normalize'
import { calculateRecordCounts, validateRecordCounts } from './record-counts'
import { validateBackupRelationships } from './relationship-validation'
import { auroraBackupV1Schema } from './schema'
import { detectDangerousKeys, detectUntrustedUserIds } from './security'
import type {
  AuroraBackupV1,
  BackupInspectionResult,
  BackupValidationIssue,
  BackupValidationPath,
} from './types'

export function validateAuroraBackup(input: unknown): {
  backup: AuroraBackupV1 | null
  issues: BackupValidationIssue[]
} {
  const issues: BackupValidationIssue[] = [
    ...detectDangerousKeys(input),
    ...detectUntrustedUserIds(input),
  ]

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      backup: null,
      issues: [
        ...issues,
        issue('INVALID_ROOT', 'error', [], 'Il backup deve essere un oggetto JSON.'),
      ],
    }
  }

  const root = input as Record<string, unknown>
  if (root.format !== AURORA_BACKUP_FORMAT) {
    issues.push(issue('UNKNOWN_FORMAT', 'error', ['format'], 'Formato backup non riconosciuto.'))
  }
  if (!('schemaVersion' in root)) {
    issues.push(issue('SCHEMA_VERSION_MISSING', 'error', ['schemaVersion'], 'schemaVersion mancante.'))
  } else if (typeof root.schemaVersion !== 'number') {
    issues.push(issue('SCHEMA_VERSION_INVALID', 'error', ['schemaVersion'], 'schemaVersion non valida.'))
  } else if (root.schemaVersion > AURORA_BACKUP_SCHEMA_VERSION) {
    issues.push(issue('FUTURE_SCHEMA_VERSION', 'error', ['schemaVersion'], 'Versione backup futura non supportata.', { version: root.schemaVersion }))
  } else if (!(SUPPORTED_AURORA_BACKUP_SCHEMA_VERSIONS as readonly number[]).includes(root.schemaVersion)) {
    issues.push(issue('UNSUPPORTED_SCHEMA_VERSION', 'error', ['schemaVersion'], 'Versione backup non supportata.', { version: root.schemaVersion }))
  }

  const parsed = auroraBackupV1Schema.safeParse(input)
  if (!parsed.success) {
    issues.push(...zodIssues(parsed.error))
    return { backup: null, issues }
  }

  const backup = parsed.data as AuroraBackupV1
  issues.push(...validateRecordCounts(backup))
  issues.push(...detectBackupDuplicates(backup))
  issues.push(...validateBackupRelationships(backup))
  issues.push(...verifyBackupChecksum(backup))
  return { backup, issues }
}

export function inspectAuroraBackup(input: unknown): BackupInspectionResult {
  try {
    const { backup, issues } = validateAuroraBackup(input)
    const normalizedBackup = backup ? normalizeAuroraBackup(backup) : null
    const recordCounts = normalizedBackup ? calculateRecordCounts(normalizedBackup) : {}
    const checksum = normalizedBackup ? computeBackupChecksum(normalizedBackup) : null
    const allIssues = [...issues]
    const valid = Boolean(normalizedBackup) && !hasErrors(allIssues)

    return {
      valid,
      backup,
      normalizedBackup,
      issues: allIssues,
      recordCounts,
      checksum,
      summary: {
        schemaVersion: typeof (input as { schemaVersion?: unknown })?.schemaVersion === 'number'
          ? (input as { schemaVersion: number }).schemaVersion
          : null,
        recordCounts,
        errorCount: allIssues.filter((item) => item.severity === 'error').length,
        warningCount: allIssues.filter((item) => item.severity === 'warning').length,
        infoCount: allIssues.filter((item) => item.severity === 'info').length,
      },
    }
  } catch {
    const issues = [issue('UNEXPECTED_VALIDATION_ERROR', 'error', [], 'Errore inatteso durante la validazione.')]
    return {
      valid: false,
      backup: null,
      normalizedBackup: null,
      issues,
      recordCounts: {},
      checksum: null,
      summary: {
        schemaVersion: null,
        recordCounts: {},
        errorCount: 1,
        warningCount: 0,
        infoCount: 0,
      },
    }
  }
}

function zodIssues(error: z.ZodError): BackupValidationIssue[] {
  return error.issues.map((item) => issue(
    'SCHEMA_VALIDATION_ERROR',
    'error',
    item.path as BackupValidationPath,
    item.message,
  ))
}
