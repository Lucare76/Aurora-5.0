import type { DryRunResult } from './types'

export function summarizeDryRunForLog(result: DryRunResult) {
  return {
    readiness: result.readiness,
    backupRecords: result.summary.backupRecords,
    collisions: result.summary.collisions,
    duplicates: result.summary.duplicates,
    blockingErrors: result.summary.blockingErrors,
    warnings: result.summary.warnings,
  }
}
