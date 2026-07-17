import { DANGEROUS_KEYS } from './constants'
import { issue } from './issue'
import type { BackupValidationIssue, BackupValidationPath } from './types'

export function detectDangerousKeys(input: unknown, path: BackupValidationPath = []): BackupValidationIssue[] {
  const issues: BackupValidationIssue[] = []
  if (!input || typeof input !== 'object') return issues

  for (const key of Object.keys(input)) {
    if ((DANGEROUS_KEYS as readonly string[]).includes(key)) {
      issues.push(issue(
        'DANGEROUS_KEY',
        'error',
        [...path, key],
        'Il backup contiene una chiave non consentita.',
        { key },
      ))
    }
    const value = (input as Record<string, unknown>)[key]
    issues.push(...detectDangerousKeys(value, [...path, key]))
  }

  return issues
}

export function detectUntrustedUserIds(input: unknown, path: BackupValidationPath = []): BackupValidationIssue[] {
  const issues: BackupValidationIssue[] = []
  if (!input || typeof input !== 'object') return issues

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (key === 'user_id' || key === 'userId') {
      issues.push(issue(
        'UNTRUSTED_USER_ID',
        'info',
        [...path, key],
        'Lo user_id nel backup e storico e non determina ownership futura.',
      ))
    }
    issues.push(...detectUntrustedUserIds(value, [...path, key]))
  }

  return issues
}
