import type { BackupIssueSeverity, BackupValidationIssue, BackupValidationPath } from './types'

export function issue(
  code: string,
  severity: BackupIssueSeverity,
  path: BackupValidationPath,
  message: string,
  details?: BackupValidationIssue['details'],
): BackupValidationIssue {
  return { code, severity, path, message, ...(details ? { details } : {}) }
}

export function hasErrors(issues: BackupValidationIssue[]): boolean {
  return issues.some((item) => item.severity === 'error')
}
