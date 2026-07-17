import type { AuroraBackupV1 } from '../types'

export type RestoreRpcPayload = AuroraBackupV1

export function buildRestoreRpcPayload(backup: AuroraBackupV1): RestoreRpcPayload {
  return backup
}
