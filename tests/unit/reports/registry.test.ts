import { describe, expect, it } from 'vitest'
import { REPORT_TYPE_CODES } from '@/lib/reports/constants'
import {
  getReportType,
  isReportTypeCode,
  REPORT_QUICK_LINK_CODES,
  REPORT_REGISTRY,
  REPORT_REGISTRY_BY_CATEGORY,
  REPORT_TEMPLATES,
  RELATED_REPORT_TOOLS,
  resolveTemplate,
} from '@/lib/reports/registry'

describe('REPORT_REGISTRY', () => {
  it('has 19 entries matching REPORT_TYPE_CODES', () => {
    expect(REPORT_REGISTRY).toHaveLength(REPORT_TYPE_CODES.length)
  })

  it('all codes are unique', () => {
    const codes = REPORT_REGISTRY.map((def) => def.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('all codes exist in REPORT_TYPE_CODES', () => {
    for (const def of REPORT_REGISTRY) {
      expect(REPORT_TYPE_CODES as readonly string[]).toContain(def.code)
    }
  })

  it('every entry has required fields and a non-empty derived href', () => {
    for (const def of REPORT_REGISTRY) {
      expect(def.label.length).toBeGreaterThan(0)
      expect(def.description.length).toBeGreaterThan(0)
      expect(def.color.length).toBeGreaterThan(0)
      expect(def.href.length).toBeGreaterThan(0)
      expect(['template', 'related']).toContain(def.kind)
      expect(typeof def.hidden).toBe('boolean')
    }
  })

  it('template entries have a periodic/thematic category; related entries have none', () => {
    for (const def of REPORT_REGISTRY) {
      if (def.kind === 'template') expect(['periodic', 'thematic']).toContain(def.category)
      else expect(def.category).toBeNull()
    }
  })

  it("template hrefs are always /reports?tpl=<code>&range=...&type=...", () => {
    for (const def of REPORT_TEMPLATES) {
      expect(def.href.startsWith('/reports?')).toBe(true)
      const params = new URLSearchParams(def.href.split('?')[1])
      expect(params.get('tpl')).toBe(def.code)
      expect(params.get('range')).toBe(def.defaultRange)
      expect(params.get('type')).toBe(def.defaultType)
    }
  })

  it('related tools never point at /reports', () => {
    for (const def of RELATED_REPORT_TOOLS) {
      expect(def.href.startsWith('/reports')).toBe(false)
    }
  })
})

describe('REPORT_TEMPLATES / RELATED_REPORT_TOOLS separation', () => {
  it('TAGS is not offered as an available template (hidden until the feature exists)', () => {
    expect(REPORT_TEMPLATES.some((def) => def.code === 'TAGS')).toBe(false)
    const tags = getReportType('TAGS')
    expect(tags?.hidden).toBe(true)
  })

  it('related tools (BUDGETS, GOALS, LOANS, RECURRING, FINANCIAL_HEALTH, DATA_INTEGRITY, SCENARIOS, TRANSACTIONS) point to their own pages, never rendered as report templates', () => {
    const expected: Record<string, string> = {
      BUDGETS: '/budgets',
      GOALS: '/goals',
      LOANS: '/loans',
      RECURRING: '/recurring',
      FINANCIAL_HEALTH: '/financial-health',
      DATA_INTEGRITY: '/data-integrity',
      SCENARIOS: '/scenarios',
      TRANSACTIONS: '/transactions',
    }
    expect(RELATED_REPORT_TOOLS.map((def) => def.code).sort()).toEqual(Object.keys(expected).sort())
    for (const def of RELATED_REPORT_TOOLS) {
      expect(def.href).toBe(expected[def.code])
      expect(def.kind).toBe('related')
    }
  })

  it('TRANSACTIONS is a related tool, not a "thematic" report template (was previously miscategorized)', () => {
    const def = getReportType('TRANSACTIONS')
    expect(def?.kind).toBe('related')
  })
})

describe('NET_WORTH vs CASH_FLOW must not collapse to the same configuration', () => {
  it('different hrefs (query strings)', () => {
    expect(getReportType('NET_WORTH')?.href).not.toBe(getReportType('CASH_FLOW')?.href)
  })

  it('different sections: NET_WORTH has net-worth/accounts, not expense/income categories; CASH_FLOW is the opposite', () => {
    const netWorth = getReportType('NET_WORTH')!
    const cashFlow = getReportType('CASH_FLOW')!
    expect(netWorth.sections).toContain('net-worth')
    expect(netWorth.sections).toContain('accounts')
    expect(netWorth.sections).not.toContain('expense-categories')
    expect(cashFlow.sections).not.toContain('net-worth')
    expect(cashFlow.sections).not.toContain('accounts')
    expect(cashFlow.sections).toContain('kpi-cashflow')
  })
})

describe('CATEGORIES vs QUARTERLY must not collapse to the same configuration', () => {
  it('different hrefs (query strings)', () => {
    expect(getReportType('CATEGORIES')?.href).not.toBe(getReportType('QUARTERLY')?.href)
  })

  it('different sections: QUARTERLY is the full overview, CATEGORIES drops the KPI row/fixed-variable/transfers/accounts', () => {
    const categories = getReportType('CATEGORIES')!
    const quarterly = getReportType('QUARTERLY')!
    expect(quarterly.sections).toContain('kpi-income')
    expect(quarterly.sections).toContain('accounts')
    expect(quarterly.sections).toContain('fixed-variable')
    expect(categories.sections).not.toContain('kpi-income')
    expect(categories.sections).not.toContain('accounts')
    expect(categories.sections).not.toContain('fixed-variable')
    expect(categories.sections).toContain('expense-categories')
  })
})

describe('resolveTemplate', () => {
  it('resolves a real, visible template', () => {
    expect(resolveTemplate('MONTHLY')?.code).toBe('MONTHLY')
    expect(resolveTemplate('NET_WORTH')?.code).toBe('NET_WORTH')
  })

  it('TAGS resolves to undefined (hidden, not to be presented as available)', () => {
    expect(resolveTemplate('TAGS')).toBeUndefined()
  })

  it('a related-tool code resolves to undefined (not a report template)', () => {
    expect(resolveTemplate('BUDGETS')).toBeUndefined()
  })

  it('handles an unknown tpl safely (no throw, no crash)', () => {
    expect(() => resolveTemplate('DOES_NOT_EXIST')).not.toThrow()
    expect(resolveTemplate('DOES_NOT_EXIST')).toBeUndefined()
  })

  it('handles null/undefined/empty safely', () => {
    expect(resolveTemplate(null)).toBeUndefined()
    expect(resolveTemplate(undefined)).toBeUndefined()
    expect(resolveTemplate('')).toBeUndefined()
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

describe('REPORT_REGISTRY_BY_CATEGORY', () => {
  it('has only periodic/thematic categories (no "extended" — those are related tools now)', () => {
    expect(Object.keys(REPORT_REGISTRY_BY_CATEGORY).sort()).toEqual(['periodic', 'thematic'])
  })

  it('periodic codes are MONTHLY, QUARTERLY, ANNUAL, CUSTOM', () => {
    const codes = REPORT_REGISTRY_BY_CATEGORY.periodic.map((d) => d.code)
    expect(codes.sort()).toEqual(['ANNUAL', 'CUSTOM', 'MONTHLY', 'QUARTERLY'])
  })
})

describe('single source of truth: widget/command-menu quick links can never diverge from the registry', () => {
  it('every REPORT_QUICK_LINK_CODES entry resolves to a real, visible template with a /reports?tpl= href', () => {
    for (const code of REPORT_QUICK_LINK_CODES) {
      const def = getReportType(code)
      expect(def).toBeDefined()
      expect(def!.hidden).toBe(false)
      expect(def!.kind).toBe('template')
      expect(def!.href).toContain(`tpl=${code}`)
    }
  })
})
