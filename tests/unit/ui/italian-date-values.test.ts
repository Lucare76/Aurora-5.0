import { describe, expect, it } from 'vitest'
import { dateInputError, formatItalianDate, formatItalianDateTime, normalizeDateDraft, parseItalianDate } from '@/lib/dates/italian'

describe('Italian display with ISO storage', () => {
  it.each([
    ['13/10/2026', '2026-10-13'],
    ['1/2/2026', '2026-02-01'],
    ['29/02/2024', '2024-02-29'],
    ['2026-10-13', '2026-10-13'],
    ['31/12/2026', '2026-12-31'],
  ])('converts %s to %s and pads the visible date', (input, iso) => {
    expect(parseItalianDate(input)).toBe(iso)
    expect(parseItalianDate(formatItalianDate(iso))).toBe(iso)
  })

  it.each(['31/02/2026', '29/02/2026', '31/04/2026', '13/13/2026', '2026-02-31', '10/13/2026', '13/10', ''])('rejects invalid date %s', (input) => {
    expect(parseItalianDate(input)).toBeNull()
  })

  it('keeps calendar dates unchanged across timezones', () => {
    expect(formatItalianDate('2026-01-01')).toBe('01/01/2026')
    expect(formatItalianDate('2026-12-31')).toBe('31/12/2026')
  })

  it('shows timestamps in Rome including the day at the year boundary', () => {
    expect(formatItalianDateTime('2025-12-31T23:30:00Z')).toBe('01/01/2026 00:30')
    expect(formatItalianDateTime('2026-07-13T22:30:00Z')).toBe('14/07/2026 00:30')
  })

  it('uses a safe placeholder for missing and invalid values', () => {
    expect(formatItalianDate(null)).toBe('—')
    expect(formatItalianDate('invalid')).toBe('—')
    expect(formatItalianDateTime(undefined)).toBe('—')
  })

  it('accepts numeric-keyboard entry and keeps ISO pastes intact', () => {
    expect(normalizeDateDraft('13102026')).toBe('13/10/2026')
    expect(normalizeDateDraft('131')).toBe('13/1')
    expect(normalizeDateDraft('2026-10-13')).toBe('2026-10-13')
  })

  it('preserves optional empty fields and enforces date bounds', () => {
    expect(dateInputError('')).toBe('')
    expect(dateInputError('14/10/2026', '2026-10-15')).toContain('15/10/2026')
    expect(dateInputError('16/10/2026', undefined, '2026-10-15')).toContain('15/10/2026')
    expect(dateInputError('15/10/2026', '2026-10-15', '2026-10-15')).toBe('')
    expect(dateInputError('31/02/2026')).not.toBe('')
  })
})
