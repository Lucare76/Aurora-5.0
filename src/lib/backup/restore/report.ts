import type { DryRunResult } from './types'

export function summarizeDryRunForLog(result: DryRunResult) {
  const errorCodes = [...new Set(result.issues.filter((i) => i.severity === 'error').map((i) => i.code))]
  const warnCodes = [...new Set(result.issues.filter((i) => i.severity === 'warning').map((i) => i.code))]
  const sectionsWithErrors = result.restorePlan
    .filter((step) => step.status !== 'ready')
    .map((step) => `${step.collection}:${step.status}`)

  return {
    readiness: result.readiness,
    backupRecords: result.summary.backupRecords,
    reconciledCategories: result.summary.reconciledCategories,
    collisions: result.summary.collisions,
    duplicates: result.summary.duplicates,
    blockingErrors: result.summary.blockingErrors,
    warnings: result.summary.warnings,
    errorCodes,
    warnCodes,
    sectionsWithErrors,
  }
}
