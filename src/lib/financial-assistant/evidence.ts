import type { AssistantEvidence } from './types'

export function money(value: number | string | null | undefined): number {
  return Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100
}

export function formatCurrency(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(value)
}

export function sumBy<T>(rows: T[], selector: (row: T) => number): number {
  return money(rows.reduce((sum, row) => sum + selector(row), 0))
}

export function evidence(metric: string, value: AssistantEvidence['value'], citationIds: string[], unit?: AssistantEvidence['unit']): AssistantEvidence {
  return { metric, value, unit, citationIds }
}

