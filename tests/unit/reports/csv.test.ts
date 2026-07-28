import { describe, expect, it } from 'vitest'
import { csvCell } from '@/lib/reports/csv'

describe('csvCell — formula injection protection', () => {
  it('wraps normal text in double quotes', () => {
    expect(csvCell('Casa')).toBe('"Casa"')
  })

  it('wraps empty string correctly', () => {
    expect(csvCell('')).toBe('""')
  })

  it('returns empty cell for null', () => {
    expect(csvCell(null)).toBe('""')
  })

  it('prefixes =SUM formula with tab to prevent injection', () => {
    expect(csvCell('=SUM(A1:A2)')).toBe('"\t=SUM(A1:A2)"')
  })

  it('prefixes + formula with tab', () => {
    expect(csvCell('+cmd')).toBe('"\t+cmd"')
  })

  it('prefixes - text with tab (user-entered text starting with minus)', () => {
    expect(csvCell('-cmd')).toBe('"\t-cmd"')
  })

  it('prefixes @SUM DDE attack with tab', () => {
    expect(csvCell('@SUM')).toBe('"\t@SUM"')
  })

  it('prefixes | pipe-prefix attack with tab', () => {
    expect(csvCell('|cmd')).toBe('"\t|cmd"')
  })

  it('does NOT prefix normal text starting with a letter', () => {
    expect(csvCell('Alimentari')).toBe('"Alimentari"')
  })

  it('does NOT prefix numeric string starting with digit', () => {
    expect(csvCell('2026-07')).toBe('"2026-07"')
  })

  it('escapes double quotes inside string', () => {
    expect(csvCell('say "hello"')).toBe('"say ""hello"""')
  })

  it('handles string with comma (CSV separator)', () => {
    expect(csvCell('Milano, Italia')).toBe('"Milano, Italia"')
  })

  it('handles string with semicolon', () => {
    expect(csvCell('A;B')).toBe('"A;B"')
  })

  it('handles newline inside string', () => {
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"')
  })

  it('formats positive number as fixed-2 decimal — no injection prefix', () => {
    expect(csvCell(1234.56)).toBe('"1234.56"')
  })

  it('formats negative number -25.00 as legitimate numeric amount — no tab prefix', () => {
    // Negative financial amounts must export as "-25.00", not "\t-25.00"
    expect(csvCell(-25)).toBe('"-25.00"')
    expect(csvCell(-25.5)).toBe('"-25.50"')
  })

  it('formats zero correctly', () => {
    expect(csvCell(0)).toBe('"0.00"')
  })

  it('formats large amount correctly', () => {
    expect(csvCell(9999.99)).toBe('"9999.99"')
  })

  it('number type is never prefixed with tab even if it would start with -', () => {
    const result = csvCell(-100)
    expect(result).not.toContain('\t')
    expect(result).toBe('"-100.00"')
  })
})
