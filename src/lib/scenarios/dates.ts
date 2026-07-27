import type { RecurringFrequency } from '@/types/database'
import type { ProjectionPeriod } from './types'
import { MONTH_LABELS_IT } from './constants'

// ── Parsing / formatting ──────────────────────────────────────────────────────

export function parseDateUTC(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00Z')
}

export function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function getPeriodKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export function getMonthLabel(year: number, month: number): string {
  return `${MONTH_LABELS_IT[month]} ${year}`
}

// ── Month arithmetic ──────────────────────────────────────────────────────────

/** First day of a given year/month (UTC). */
export function monthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 1))
}

/** Last day of a given year/month (UTC). */
export function monthEnd(year: number, month: number): Date {
  return new Date(Date.UTC(year, month + 1, 0))
}

/** Adds n months to a year/month pair, returns [year, month]. */
export function addMonths(year: number, month: number, n: number): [number, number] {
  const total = month + n
  return [year + Math.floor(total / 12), ((total % 12) + 12) % 12]
}

// ── Frequency arithmetic ──────────────────────────────────────────────────────

export function addFrequency(date: Date, frequency: RecurringFrequency): Date {
  const d = new Date(date)
  switch (frequency) {
    case 'daily':     d.setUTCDate(d.getUTCDate() + 1); break
    case 'weekly':    d.setUTCDate(d.getUTCDate() + 7); break
    case 'biweekly':  d.setUTCDate(d.getUTCDate() + 14); break
    case 'monthly':   d.setUTCMonth(d.getUTCMonth() + 1); break
    case 'quarterly': d.setUTCMonth(d.getUTCMonth() + 3); break
    case 'yearly':    d.setUTCFullYear(d.getUTCFullYear() + 1); break
  }
  return d
}

// ── Occurrence counting ───────────────────────────────────────────────────────

/**
 * Counts how many times a recurring rule fires within [periodStart, periodEnd].
 * Handles rule.start_date and rule.end_date constraints.
 * Returns 0 for inactive rules.
 */
export function countOccurrencesInPeriod(
  rule: {
    is_active: boolean
    start_date: string
    end_date: string | null
    next_due_date: string
    frequency: RecurringFrequency
    amount: number
  },
  periodStart: Date,
  periodEnd: Date,
): number {
  if (!rule.is_active) return 0

  const ruleStart = parseDateUTC(rule.start_date)
  const ruleEnd = rule.end_date ? parseDateUTC(rule.end_date) : null

  // Rule ends before period starts
  if (ruleEnd && ruleEnd < periodStart) return 0
  // Rule starts after period ends
  if (ruleStart > periodEnd) return 0

  // Walk forward from rule.start_date until we reach or pass the period
  let current = new Date(ruleStart)
  let count = 0
  const limit = 3660 // safety cap (≤ 10 years daily)

  for (let i = 0; i < limit; i++) {
    if (current > periodEnd) break
    if (current >= periodStart) {
      // Check rule.end_date constraint
      if (!ruleEnd || current <= ruleEnd) count++
    }
    current = addFrequency(current, rule.frequency)
  }

  return count
}

// ── Timeline generation ───────────────────────────────────────────────────────

/**
 * Generates an ordered list of monthly projection periods.
 * startDate is the first day of the first period.
 * horizonMonths is the number of periods (months).
 */
export function generatePeriods(startDate: string, horizonMonths: number): ProjectionPeriod[] {
  const base = parseDateUTC(startDate)
  const year0 = base.getUTCFullYear()
  const month0 = base.getUTCMonth()

  const periods: ProjectionPeriod[] = []
  for (let i = 0; i < horizonMonths; i++) {
    const [year, month] = addMonths(year0, month0, i)
    const key = getPeriodKey(year, month)
    const label = getMonthLabel(year, month)
    const start = monthStart(year, month)
    const end = monthEnd(year, month)
    periods.push({
      year,
      month,
      key,
      label,
      startDate: formatDateISO(start),
      endDate: formatDateISO(end),
    })
  }
  return periods
}

/** Returns the period key for a given ISO date string. */
export function periodKeyForDate(dateStr: string): string {
  const d = parseDateUTC(dateStr)
  return getPeriodKey(d.getUTCFullYear(), d.getUTCMonth())
}

/** Checks whether a date string falls within a period. */
export function dateInPeriod(dateStr: string, period: ProjectionPeriod): boolean {
  return dateStr >= period.startDate && dateStr <= period.endDate
}

/** Returns the first day of the current month (UTC) as ISO string. */
export function currentMonthStart(now: Date): string {
  return formatDateISO(monthStart(now.getUTCFullYear(), now.getUTCMonth()))
}

/** Computes the number of months between two YYYY-MM-DD strings (floor). */
export function monthsBetween(fromDate: string, toDate: string): number {
  const from = parseDateUTC(fromDate)
  const to = parseDateUTC(toDate)
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth())
  )
}
