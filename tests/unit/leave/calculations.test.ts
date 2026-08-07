import { describe, expect, it } from 'vitest'

import {
  annualVacationAllowance,
  annualVacationRemaining,
  annualVacationUsed,
  monthlyPermitAllowance,
  monthlyPermitRemaining,
  monthlyPermitUsed,
  permitUsagePercentage,
  usageTone,
  vacationUsagePercentage,
} from '@/lib/leave/calculations'
import type { LeaveEntry, LeaveSettings } from '@/types/database'

const settings = {
  vacation_days_per_year: 30,
  permit_104_hours_per_month: 24,
} satisfies Pick<LeaveSettings, 'vacation_days_per_year' | 'permit_104_hours_per_month'>

describe('leave calculations', () => {
  it('calcola ferie annuali senza riporto tra anni', () => {
    const entries = [
      entry({ type: 'VACATION', start_date: '2026-08-01', end_date: '2026-08-10', days: 8 }),
      entry({ type: 'VACATION', start_date: '2026-12-20', end_date: '2026-12-24', days: 4 }),
      entry({ type: 'VACATION', start_date: '2027-01-02', end_date: '2027-01-05', days: 3 }),
    ]

    expect(annualVacationAllowance(settings)).toBe(30)
    expect(annualVacationUsed(entries, 2026)).toBe(12)
    expect(annualVacationRemaining(settings, entries, 2026)).toBe(18)
    expect(vacationUsagePercentage(settings, entries, 2026)).toBe(40)
    expect(annualVacationUsed(entries, 2027)).toBe(3)
  })

  it('calcola permessi 104 mensili senza riporto tra mesi', () => {
    const entries = [
      entry({ type: 'PERMIT_104', start_date: '2026-08-07', end_date: '2026-08-07', hours: 2.25 }),
      entry({ type: 'PERMIT_104', start_date: '2026-08-20', end_date: '2026-08-20', hours: 4 }),
      entry({ type: 'PERMIT_104', start_date: '2026-09-01', end_date: '2026-09-01', hours: 8 }),
    ]

    expect(monthlyPermitAllowance(settings)).toBe(24)
    expect(monthlyPermitUsed(entries, 2026, 8)).toBe(6.25)
    expect(monthlyPermitRemaining(settings, entries, 2026, 8)).toBe(17.75)
    expect(permitUsagePercentage(settings, entries, 2026, 8)).toBe(26.04)
    expect(monthlyPermitUsed(entries, 2026, 9)).toBe(8)
  })

  it('assegna tono success, warning e critical in base alla percentuale', () => {
    expect(usageTone(79.99)).toBe('success')
    expect(usageTone(80)).toBe('warning')
    expect(usageTone(100)).toBe('critical')
  })
})

function entry(overrides: Partial<LeaveEntry>): LeaveEntry {
  return {
    id: crypto.randomUUID(),
    user_id: '11111111-1111-4111-8111-111111111111',
    type: 'VACATION',
    start_date: '2026-01-01',
    end_date: '2026-01-01',
    days: null,
    hours: null,
    start_time: null,
    end_time: null,
    note: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}
