import type { LeaveEntry, LeaveSettings } from '@/types/database'

export type LeaveSettingsLike = Pick<LeaveSettings, 'vacation_days_per_year' | 'permit_104_hours_per_month'>
export type LeaveEntryLike = Pick<LeaveEntry, 'type' | 'start_date' | 'days' | 'hours'>

export function annualVacationAllowance(settings: LeaveSettingsLike): number {
  return nonNegative(settings.vacation_days_per_year)
}

export function annualVacationUsed(entries: LeaveEntryLike[], year: number): number {
  return round2(entries
    .filter((entry) => entry.type === 'VACATION' && yearFromDate(entry.start_date) === year)
    .reduce((sum, entry) => sum + nonNegative(entry.days ?? 0), 0))
}

export function annualVacationRemaining(settings: LeaveSettingsLike, entries: LeaveEntryLike[], year: number): number {
  return round2(Math.max(annualVacationAllowance(settings) - annualVacationUsed(entries, year), 0))
}

export function vacationUsagePercentage(settings: LeaveSettingsLike, entries: LeaveEntryLike[], year: number): number {
  return percentage(annualVacationUsed(entries, year), annualVacationAllowance(settings))
}

export function monthlyPermitAllowance(settings: LeaveSettingsLike): number {
  return nonNegative(settings.permit_104_hours_per_month)
}

export function monthlyPermitUsed(entries: LeaveEntryLike[], year: number, month: number): number {
  return round2(entries
    .filter((entry) => entry.type === 'PERMIT_104' && yearFromDate(entry.start_date) === year && monthFromDate(entry.start_date) === month)
    .reduce((sum, entry) => sum + nonNegative(entry.hours ?? 0), 0))
}

export function monthlyPermitRemaining(settings: LeaveSettingsLike, entries: LeaveEntryLike[], year: number, month: number): number {
  return round2(Math.max(monthlyPermitAllowance(settings) - monthlyPermitUsed(entries, year, month), 0))
}

export function permitUsagePercentage(settings: LeaveSettingsLike, entries: LeaveEntryLike[], year: number, month: number): number {
  return percentage(monthlyPermitUsed(entries, year, month), monthlyPermitAllowance(settings))
}

export function usageTone(percent: number): 'success' | 'warning' | 'critical' {
  if (percent >= 100) return 'critical'
  if (percent >= 80) return 'warning'
  return 'success'
}

function yearFromDate(date: string): number {
  return Number(date.slice(0, 4))
}

function monthFromDate(date: string): number {
  return Number(date.slice(5, 7))
}

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(value, 0) : 0
}

function percentage(used: number, allowance: number): number {
  if (allowance <= 0) return used > 0 ? 100 : 0
  return Math.min(round2((used / allowance) * 100), 999)
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
