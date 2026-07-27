import { MONTH_LABELS_IT } from './constants'

export function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function roundScore(value: number): number {
  return Math.round(clamp(value))
}

export function toNumber(value: number | string | null | undefined): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

export function dateKey(date: Date): string {
  return date.toLocaleDateString('en-CA')
}

export function parseDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00`)
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

export function daysBetween(from: string, to: string): number {
  return Math.max(1, Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000) + 1)
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function buildMonthPeriod(date: Date): { from: string; to: string; key: string; label: string; days: number; isCurrentPeriod: boolean } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  const key = monthKey(start)
  return {
    from: dateKey(start),
    to: dateKey(end),
    key,
    label: `${MONTH_LABELS_IT[start.getMonth()]} ${start.getFullYear()}`,
    days: daysBetween(dateKey(start), dateKey(end)),
    isCurrentPeriod: key === monthKey(new Date()),
  }
}

export function previousComparablePeriod(period: { from: string; to: string }): { from: string; to: string; key: string; label: string; days: number; isCurrentPeriod: boolean } {
  const start = parseDate(period.from)
  const end = parseDate(period.to)
  const days = daysBetween(period.from, period.to)
  const prevEnd = addDays(start, -1)
  const prevStart = addDays(prevEnd, -(days - 1))
  const key = monthKey(prevStart)
  return {
    from: dateKey(prevStart),
    to: dateKey(prevEnd),
    key,
    label: `${dateKey(prevStart)} - ${dateKey(prevEnd)}`,
    days,
    isCurrentPeriod: false,
  }
}

export function safeRatio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null
  return roundMoney((numerator / denominator) * 100)
}

export function average(values: number[]): number {
  if (values.length === 0) return 0
  return roundMoney(values.reduce((sum, value) => sum + value, 0) / values.length)
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(roundMoney(value))
}
