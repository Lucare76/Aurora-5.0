import { createHash } from 'node:crypto'

import { canonicalizeAuroraBackup } from './canonicalize'
import { issue } from './issue'
import type { AuroraBackupV1, BackupValidationIssue } from './types'

const CHECKSUM_RE = /^sha256:[a-f0-9]{64}$/

export function computeBackupChecksum(backup: AuroraBackupV1): string {
  const canonical = canonicalizeAuroraBackup(backup)
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`
}

export function verifyBackupChecksum(backup: AuroraBackupV1): BackupValidationIssue[] {
  const declared = backup.integrity.checksum
  if (!declared) {
    return [issue('CHECKSUM_MISSING', 'error', ['integrity', 'checksum'], 'Checksum mancante.')]
  }
  if (!CHECKSUM_RE.test(declared)) {
    return [issue('CHECKSUM_FORMAT_INVALID', 'error', ['integrity', 'checksum'], 'Formato checksum non valido.')]
  }
  const computed = computeBackupChecksum(backup)
  if (declared !== computed) {
    return [issue('CHECKSUM_MISMATCH', 'error', ['integrity', 'checksum'], 'Checksum non corrispondente.', { expected: computed })]
  }
  return [issue('CHECKSUM_VALID', 'info', ['integrity', 'checksum'], 'Checksum valido.')]
}
