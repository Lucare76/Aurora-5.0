import { createHash, randomBytes } from 'node:crypto'

import type { BackupAuthenticatedUser } from '../export/fetch-user-backup-data'
import { inspectAuroraBackup } from '../validate'
import { fetchCurrentUserDataSnapshot } from './current-state'
import { runRestoreDryRun } from './dry-run'
import type { CurrentUserDataSnapshot } from './types'

export const RESTORE_CONFIRMATION_PHRASE = 'RIPRISTINA AURORA'
export const RESTORE_TOKEN_TTL_MS = 5 * 60 * 1000
export const MAX_RESTORE_BACKUP_BYTES = 10 * 1024 * 1024

export type ParsedRestoreBackup = {
  backup: NonNullable<ReturnType<typeof inspectAuroraBackup>['normalizedBackup']>
  checksum: string
  dryRun: ReturnType<typeof runRestoreDryRun>
}

export type RestorePrepareToken = {
  token: string
  tokenHash: string
  expiresAt: string
}

export function parseJsonSafely(value: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(value) as unknown }
  } catch {
    return { ok: false }
  }
}

export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

export function assertJsonFilename(filename: string): boolean {
  return filename.toLowerCase().endsWith('.json')
}

export function createRestoreToken(now = new Date()): RestorePrepareToken {
  const token = randomBytes(32).toString('base64url')
  return {
    token,
    tokenHash: hashRestoreToken(token),
    expiresAt: new Date(now.getTime() + RESTORE_TOKEN_TTL_MS).toISOString(),
  }
}

export function hashRestoreToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function validateBackupForRealRestore(
  content: string,
  snapshot: CurrentUserDataSnapshot,
): Promise<ParsedRestoreBackup> {
  const parsed = parseJsonSafely(content)
  if (!parsed.ok) {
    throw new RestorePreparationError('INVALID_BACKUP', 'Il file backup non contiene JSON valido')
  }

  const inspection = inspectAuroraBackup(parsed.value)
  if (!inspection.valid || !inspection.normalizedBackup || !inspection.checksum) {
    throw new RestorePreparationError('INVALID_BACKUP', 'Backup non valido')
  }

  const dryRun = runRestoreDryRun({
    backup: inspection.normalizedBackup,
    inspectionIssues: inspection.issues,
    snapshot,
    options: { mode: 'empty_account_restore' },
  })

  if (dryRun.readiness !== 'ready') {
    throw new RestoreNotReadyError(dryRun)
  }

  return {
    backup: inspection.normalizedBackup,
    checksum: inspection.checksum,
    dryRun,
  }
}

export async function buildRestorePreparation(
  content: string,
  snapshot: CurrentUserDataSnapshot,
) {
  const parsed = await validateBackupForRealRestore(content, snapshot)
  const token = createRestoreToken()

  return {
    ...parsed,
    token,
    requiredConfirmation: RESTORE_CONFIRMATION_PHRASE,
  }
}

export async function readRestoreSnapshot<TSupabase>(
  supabase: TSupabase,
  user: BackupAuthenticatedUser,
) {
  return fetchCurrentUserDataSnapshot(supabase as never, user)
}

export class RestorePreparationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'RestorePreparationError'
  }
}

export class RestoreNotReadyError extends Error {
  public readonly code = 'RESTORE_NOT_READY'

  constructor(public readonly dryRun: ReturnType<typeof runRestoreDryRun>) {
    super('Restore is not ready.')
    this.name = 'RestoreNotReadyError'
  }
}
