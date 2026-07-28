import { describe, expect, it } from 'vitest'
import { REPORT_TYPE_CODES } from '@/lib/reports/constants'
import {
  REPORT_REGISTRY,
  REPORT_REGISTRY_BY_CATEGORY,
  getReportType,
  isReportTypeCode,
} from '@/lib/reports/registry'

describe('REPORT_REGISTRY', () => {
  it('has 19 entries matching REPORT_TYPE_CODES', () => {
    expect(REPORT_REGISTRY).toHaveLength(REPORT_TYPE_CODES.length)
  })

  it('all codes are unique', () => {
    const codes = REPORT_REGISTRY.map((def) => def.code)
    const unique = new Set(codes)
    expect(unique.size).toBe(codes.length)
  })

  it('all codes exist in REPORT_TYPE_CODES', () => {
    for (const def of REPORT_REGISTRY) {
      expect(REPORT_TYPE_CODES as readonly string[]).toContain(def.code)
    }
  })

  it('every entry has required fields', () => {
    for (const def of REPORT_REGISTRY) {
      expect(def.label.length).toBeGreaterThan(0)
      expect(def.description.length).toBeGreaterThan(0)
      expect(def.sections.length).toBeGreaterThan(0)
      expect(def.color.length).toBeGreaterThan(0)
      expect(def.href.length).toBeGreaterThan(0)
      expect(['periodic', 'thematic', 'extended']).toContain(def.category)
    }
  })

  it('defaultRange is a valid ReportRange', () => {
    const validRanges = ['current-month', 'previous-month', 'last-3-months', 'last-6-months', 'current-year', 'previous-year', 'last-12-months', 'custom']
    for (const def of REPORT_REGISTRY) {
      expect(validRanges).toContain(def.defaultRange)
    }
  })
})

describe('REPORT_REGISTRY_BY_CATEGORY', () => {
  it('has all three categories', () => {
    expect(Object.keys(REPORT_REGISTRY_BY_CATEGORY)).toEqual(['periodic', 'thematic', 'extended'])
  })

  it('total across categories equals 19', () => {
    const total =
      REPORT_REGISTRY_BY_CATEGORY.periodic.length +
      REPORT_REGISTRY_BY_CATEGORY.thematic.length +
      REPORT_REGISTRY_BY_CATEGORY.extended.length
    expect(total).toBe(19)
  })

  it('periodic category has 4 entries', () => {
    expect(REPORT_REGISTRY_BY_CATEGORY.periodic).toHaveLength(4)
  })

  it('periodic codes are MONTHLY, QUARTERLY, ANNUAL, CUSTOM', () => {
    const codes = REPORT_REGISTRY_BY_CATEGORY.periodic.map((d) => d.code)
    expect(codes).toContain('MONTHLY')
    expect(codes).toContain('QUARTERLY')
    expect(codes).toContain('ANNUAL')
    expect(codes).toContain('CUSTOM')
  })

  it('extended category has 7 entries', () => {
    expect(REPORT_REGISTRY_BY_CATEGORY.extended).toHaveLength(7)
  })
})

describe('getReportType', () => {
  it('returns correct definition for MONTHLY', () => {
    const def = getReportType('MONTHLY')
    expect(def).toBeDefined()
    expect(def?.code).toBe('MONTHLY')
    expect(def?.defaultRange).toBe('current-month')
  })

  it('returns correct definition for ANNUAL', () => {
    const def = getReportType('ANNUAL')
    expect(def?.defaultRange).toBe('current-year')
  })

  it('MONTHLY sections include summary and monthly-series', () => {
    const def = getReportType('MONTHLY')
    expect(def?.sections).toContain('summary')
    expect(def?.sections).toContain('monthly-series')
  })

  it('INCOME defaultRange is last-6-months', () => {
    const def = getReportType('INCOME')
    expect(def?.defaultRange).toBe('last-6-months')
  })

  it('EXPENSES defaultRange is last-6-months', () => {
    const def = getReportType('EXPENSES')
    expect(def?.defaultRange).toBe('last-6-months')
  })

  it('CASH_FLOW defaultRange is last-12-months', () => {
    const def = getReportType('CASH_FLOW')
    expect(def?.defaultRange).toBe('last-12-months')
  })
})

describe('isReportTypeCode', () => {
  it('returns true for valid codes', () => {
    expect(isReportTypeCode('MONTHLY')).toBe(true)
    expect(isReportTypeCode('ANNUAL')).toBe(true)
    expect(isReportTypeCode('TAGS')).toBe(true)
  })

  it('returns false for invalid values', () => {
    expect(isReportTypeCode('UNKNOWN')).toBe(false)
    expect(isReportTypeCode('')).toBe(false)
    expect(isReportTypeCode(null)).toBe(false)
    expect(isReportTypeCode(undefined)).toBe(false)
    expect(isReportTypeCode(42)).toBe(false)
  })
})
