import packageJson from '../../../../package.json'

import {
  AURORA_BACKUP_FORMAT,
  AURORA_BACKUP_SCHEMA_VERSION,
} from '../constants'
import { computeBackupChecksum } from '../checksum'
import { calculateRecordCounts } from '../record-counts'
import { inspectAuroraBackup } from '../validate'
import type { AuroraBackupV1, BackupInspectionResult } from '../types'

import type { UserBackupData } from './fetch-user-backup-data'
import { mapUserBackupDataToV1Data } from './map-backup-data'

export type GenerateAuroraBackupOptions = {
  createdAt?: Date
  appVersion?: string
  locale?: string
  timezone?: string
}

export type GeneratedAuroraBackup = {
  backup: AuroraBackupV1
  json: string
  inspection: BackupInspectionResult
}

export class BackupGenerationError extends Error {
  constructor(
    message: string,
    public readonly inspection?: BackupInspectionResult,
  ) {
    super(message)
    this.name = 'BackupGenerationError'
  }
}

export function generateAuroraBackup(
  input: UserBackupData,
  options: GenerateAuroraBackupOptions = {},
): GeneratedAuroraBackup {
  const createdAt = options.createdAt ?? new Date()
  const data = mapUserBackupDataToV1Data(input)
  const locale = options.locale ?? data.profile.locale
  const timezone = options.timezone ?? data.profile.timezone
  const defaultCurrency = data.profile.currency

  const backupWithoutChecksum: AuroraBackupV1 = {
    format: AURORA_BACKUP_FORMAT,
    schemaVersion: AURORA_BACKUP_SCHEMA_VERSION,
    appVersion: options.appVersion ?? packageJson.version,
    createdAt: createdAt.toISOString(),
    exportedBy: {
      displayName: data.profile.display_name,
    },
    defaultCurrency,
    metadata: {
      source: 'aurora',
      locale,
      timezone,
      notes: 'mode=full',
    },
    data,
    integrity: {
      recordCounts: {
        accounts: 0,
        categories: 0,
        transactions: 0,
        budgets: 0,
        recurringRules: 0,
        loans: 0,
        loanPayments: 0,
        birthdays: 0,
        birthdayReminderLog: 0,
        auditLogs: 0,
      },
      tableChecksums: {},
      checksum: null,
    },
  }

  backupWithoutChecksum.integrity.recordCounts = calculateRecordCounts(backupWithoutChecksum)

  const checksum = computeBackupChecksum(backupWithoutChecksum)
  const backup: AuroraBackupV1 = {
    ...backupWithoutChecksum,
    integrity: {
      ...backupWithoutChecksum.integrity,
      checksum,
    },
  }

  const inspection = inspectAuroraBackup(backup)

  if (!inspection.valid) {
    throw new BackupGenerationError('Generated Aurora Backup v1 is invalid.', inspection)
  }

  return {
    backup,
    json: serializeAuroraBackup(backup),
    inspection,
  }
}

export function serializeAuroraBackup(backup: AuroraBackupV1): string {
  return `${JSON.stringify(backup, (_key, value: unknown) => {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return null
    }
    return value
  }, 2)}\n`
}
