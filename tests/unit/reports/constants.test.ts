import { describe, expect, it } from 'vitest'
import {
  REPORT_ENGINE_VERSION,
  REPORT_EXPORT_VERSION,
  REPORT_REGISTRY_VERSION,
  REPORT_SCHEMA_VERSION,
  REPORT_TYPE_CODES,
} from '@/lib/reports/constants'

describe('report constants', () => {
  it('REPORT_TYPE_CODES has 19 entries', () => {
    expect(REPORT_TYPE_CODES).toHaveLength(19)
  })

  it('REPORT_TYPE_CODES contains all expected codes', () => {
    const expected = [
      'MONTHLY', 'QUARTERLY', 'ANNUAL', 'CUSTOM',
      'INCOME', 'EXPENSES', 'CASH_FLOW', 'ACCOUNTS', 'NET_WORTH',
      'BUDGETS', 'GOALS', 'LOANS', 'RECURRING',
      'FINANCIAL_HEALTH', 'DATA_INTEGRITY', 'SCENARIOS',
      'TRANSACTIONS', 'CATEGORIES', 'TAGS',
    ]
    for (const code of expected) {
      expect(REPORT_TYPE_CODES as readonly string[]).toContain(code)
    }
  })

  it('REPORT_TYPE_CODES has no duplicates', () => {
    const unique = new Set(REPORT_TYPE_CODES)
    expect(unique.size).toBe(REPORT_TYPE_CODES.length)
  })

  it('REPORT_ENGINE_VERSION is a semver string', () => {
    expect(REPORT_ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('REPORT_SCHEMA_VERSION is a positive integer', () => {
    expect(REPORT_SCHEMA_VERSION).toBe(1)
    expect(typeof REPORT_SCHEMA_VERSION).toBe('number')
  })

  it('REPORT_REGISTRY_VERSION is a semver string', () => {
    expect(REPORT_REGISTRY_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('REPORT_EXPORT_VERSION is a semver string', () => {
    expect(REPORT_EXPORT_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
