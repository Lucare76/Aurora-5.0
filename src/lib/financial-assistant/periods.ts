import type { FinancialAssistantPeriod, ResolvedPeriod } from './types'

function iso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
}

export function resolvePeriod(key: FinancialAssistantPeriod = 'CURRENT_MONTH', now = new Date()): ResolvedPeriod {
  const utcNow = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  if (key === 'ALL_TIME') return { key, from: null, to: null, label: 'tutto lo storico' }

  const base = startOfMonth(utcNow)
  if (key === 'PREVIOUS_MONTH') base.setUTCMonth(base.getUTCMonth() - 1)
  if (key === 'LAST_3_MONTHS') base.setUTCMonth(base.getUTCMonth() - 2)
  if (key === 'LAST_6_MONTHS') base.setUTCMonth(base.getUTCMonth() - 5)
  if (key === 'LAST_12_MONTHS') base.setUTCMonth(base.getUTCMonth() - 11)

  const to = key === 'CURRENT_MONTH' || key === 'PREVIOUS_MONTH'
    ? endOfMonth(base)
    : endOfMonth(utcNow)

  return {
    key,
    from: iso(base),
    to: iso(to),
    label: key === 'CURRENT_MONTH'
      ? 'mese corrente'
      : key === 'PREVIOUS_MONTH'
        ? 'mese precedente'
        : `ultimi ${key.split('_')[1]} mesi`,
  }
}

