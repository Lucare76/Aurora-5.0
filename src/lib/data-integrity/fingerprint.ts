import { createHash } from 'node:crypto'
import type { DataIntegrityRuleCode } from './types'

function normalizePart(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ')
}

export function normalizeEntityIds(entityIds: string[]): string[] {
  return [...new Set(entityIds.map((id) => normalizePart(id)).filter(Boolean))].sort()
}

export function createDataIntegrityFingerprint(params: {
  userId: string
  ruleCode: DataIntegrityRuleCode
  entityType: string
  entityIds: string[]
  parameters?: Array<string | number | boolean | null | undefined>
}): string {
  const payload = [
    normalizePart(params.userId),
    params.ruleCode,
    normalizePart(params.entityType),
    ...normalizeEntityIds(params.entityIds),
    ...(params.parameters ?? []).map(normalizePart),
  ].join('|')
  return createHash('sha256').update(payload).digest('hex')
}

export function normalizeText(value: string | null | undefined): string {
  return normalizePart(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
}

export function cents(value: number): number {
  return Math.round(Number(value) * 100)
}
