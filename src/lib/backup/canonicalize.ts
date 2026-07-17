import type { AuroraBackupV1 } from './types'
import { stripChecksum } from './normalize'

export function canonicalizeValue(value: unknown): string {
  return JSON.stringify(canonicalValue(value))
}

export function canonicalizeAuroraBackup(backup: AuroraBackupV1): string {
  return canonicalizeValue(stripChecksum(backup))
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (!value || typeof value !== 'object') return value
  const object = value as Record<string, unknown>
  return Object.keys(object)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = canonicalValue(object[key])
      return result
    }, {})
}
