import { describe, it, expect } from 'vitest'
import {
  parseDateUTC, formatDateISO, getPeriodKey, dateInPeriod,
  monthsBetween, generatePeriods, addFrequency, countOccurrencesInPeriod,
} from '@/lib/scenarios/dates'

describe('parseDateUTC', () => {
  it('parses YYYY-MM-DD as UTC midnight', () => {
    const d = parseDateUTC('2026-01-15')
    expect(d.getUTCFullYear()).toBe(2026)
    expect(d.getUTCMonth()).toBe(0)
    expect(d.getUTCDate()).toBe(15)
  })
})

describe('formatDateISO', () => {
  it('formats date as YYYY-MM-DD', () => {
    expect(formatDateISO(new Date('2026-03-05'))).toBe('2026-03-05')
  })
})

describe('getPeriodKey', () => {
  it('zero-pads month', () => {
    expect(getPeriodKey(2026, 0)).toBe('2026-01')  // month 0 = January (0-based)
    expect(getPeriodKey(2026, 11)).toBe('2026-12') // month 11 = December
  })
})

describe('dateInPeriod', () => {
  const period = {
    year: 2026, month: 0, key: '2026-01',
    label: 'gen 2026', startDate: '2026-01-01', endDate: '2026-01-31',
  }
  it('returns true for date in period', () => {
    expect(dateInPeriod('2026-01-15', period)).toBe(true)
  })
  it('returns true for boundary dates', () => {
    expect(dateInPeriod('2026-01-01', period)).toBe(true)
    expect(dateInPeriod('2026-01-31', period)).toBe(true)
  })
  it('returns false for date outside period', () => {
    expect(dateInPeriod('2026-02-01', period)).toBe(false)
  })
})

describe('monthsBetween', () => {
  it('computes positive difference', () => {
    expect(monthsBetween('2026-01-01', '2026-04-01')).toBe(3)
  })
  it('same month = 0', () => {
    expect(monthsBetween('2026-01-01', '2026-01-31')).toBe(0)
  })
})

describe('generatePeriods', () => {
  it('generates correct number of periods', () => {
    const periods = generatePeriods('2026-01-01', 3)
    expect(periods).toHaveLength(3)
    expect(periods[0].key).toBe('2026-01')
    expect(periods[2].key).toBe('2026-03')
  })

  it('sets correct start/end dates', () => {
    const [p] = generatePeriods('2026-02-01', 1)
    expect(p.startDate).toBe('2026-02-01')
    expect(p.endDate).toBe('2026-02-28')
  })
})

describe('addFrequency', () => {
  it('monthly adds one month', () => {
    const d = addFrequency(new Date('2026-01-01'), 'monthly')
    expect(d.getUTCMonth()).toBe(1) // February
  })
  it('weekly adds 7 days', () => {
    const d = addFrequency(new Date('2026-01-01'), 'weekly')
    expect(d.getUTCDate()).toBe(8)
  })
  it('yearly adds one year', () => {
    const d = addFrequency(new Date('2026-01-01'), 'yearly')
    expect(d.getUTCFullYear()).toBe(2027)
  })
})

describe('countOccurrencesInPeriod', () => {
  const monthlyRule = {
    is_active: true,
    start_date: '2026-01-15',
    end_date: null,
    next_due_date: '2026-01-15',
    frequency: 'monthly' as const,
    amount: 100,
  }

  it('counts 1 monthly occurrence in the start month', () => {
    const n = countOccurrencesInPeriod(
      monthlyRule,
      parseDateUTC('2026-01-01'),
      parseDateUTC('2026-01-31'),
    )
    expect(n).toBe(1)
  })

  it('returns 0 before rule starts', () => {
    const n = countOccurrencesInPeriod(
      monthlyRule,
      parseDateUTC('2025-12-01'),
      parseDateUTC('2025-12-31'),
    )
    expect(n).toBe(0)
  })

  it('counts weekly occurrences correctly', () => {
    const weeklyRule = { ...monthlyRule, frequency: 'weekly' as const, start_date: '2026-01-01' }
    // Jan 2026 has 5 Thursdays (1,8,15,22,29 — all thursdays)
    const n = countOccurrencesInPeriod(
      weeklyRule,
      parseDateUTC('2026-01-01'),
      parseDateUTC('2026-01-31'),
    )
    expect(n).toBe(5) // 4 or 5 depending on start day
  })
})
