import { describe, expect, it } from 'vitest'
import { getReportType } from '@/lib/reports/registry'
import type { ReportSection } from '@/lib/reports/registry'
import {
  getActiveSections,
  getAvailableTableViews,
  getCategoryMode,
  hasSection,
  resolveInitialFilters,
  shouldShowTypeFilter,
} from '@/lib/reports/template-view'
import type { ReportDetailTableView } from '@/lib/reports/types'

const NOW = new Date('2026-09-12T12:00:00.000Z')

const ALL_SECTIONS: ReportSection[] = [
  'kpi-income', 'kpi-expenses', 'kpi-cashflow', 'kpi-net-worth',
  'monthly-series', 'expense-categories', 'income-categories',
  'fixed-variable', 'net-worth', 'transfers-summary', 'comparison', 'insights', 'accounts',
]

type TemplateExpectation = {
  code: string
  range: string
  type: string
  present: ReportSection[]
  tableViews: ReportDetailTableView[]
  categoryMode: 'income' | 'expense' | 'both'
  showTypeFilter: boolean
}

const FULL_OVERVIEW_SECTIONS: ReportSection[] = ALL_SECTIONS

const MATRIX: TemplateExpectation[] = [
  { code: 'MONTHLY', range: 'current-month', type: 'both', present: FULL_OVERVIEW_SECTIONS, tableViews: ['monthly', 'categories', 'accounts'], categoryMode: 'expense', showTypeFilter: true },
  { code: 'QUARTERLY', range: 'last-3-months', type: 'both', present: FULL_OVERVIEW_SECTIONS, tableViews: ['monthly', 'categories', 'accounts'], categoryMode: 'expense', showTypeFilter: true },
  { code: 'ANNUAL', range: 'current-year', type: 'both', present: FULL_OVERVIEW_SECTIONS, tableViews: ['monthly', 'categories', 'accounts'], categoryMode: 'expense', showTypeFilter: true },
  { code: 'CUSTOM', range: 'custom', type: 'both', present: FULL_OVERVIEW_SECTIONS, tableViews: ['monthly', 'categories', 'accounts'], categoryMode: 'expense', showTypeFilter: true },
  { code: 'INCOME', range: 'last-6-months', type: 'income', present: ['kpi-income', 'monthly-series', 'income-categories', 'insights'], tableViews: ['monthly', 'categories'], categoryMode: 'income', showTypeFilter: true },
  { code: 'EXPENSES', range: 'last-6-months', type: 'expense', present: ['kpi-expenses', 'monthly-series', 'expense-categories', 'fixed-variable', 'insights'], tableViews: ['monthly', 'categories'], categoryMode: 'expense', showTypeFilter: true },
  { code: 'CASH_FLOW', range: 'last-12-months', type: 'both', present: ['kpi-income', 'kpi-expenses', 'kpi-cashflow', 'monthly-series', 'transfers-summary', 'insights'], tableViews: ['monthly'], categoryMode: 'expense', showTypeFilter: true },
  { code: 'ACCOUNTS', range: 'current-month', type: 'all', present: ['kpi-net-worth', 'accounts'], tableViews: ['accounts'], categoryMode: 'expense', showTypeFilter: false },
  { code: 'NET_WORTH', range: 'last-12-months', type: 'all', present: ['kpi-net-worth', 'net-worth', 'accounts'], tableViews: ['accounts'], categoryMode: 'expense', showTypeFilter: false },
  { code: 'CATEGORIES', range: 'last-3-months', type: 'both', present: ['expense-categories', 'income-categories', 'insights'], tableViews: ['categories'], categoryMode: 'both', showTypeFilter: true },
]

describe('Matrice completa dei 10 template Report', () => {
  for (const expectation of MATRIX) {
    const { code, range, type, present, tableViews, categoryMode, showTypeFilter } = expectation
    const absent = ALL_SECTIONS.filter((section) => !present.includes(section))

    describe(code, () => {
      it('range/type di default nel registry', () => {
        const def = getReportType(code as never)
        expect(def?.defaultRange).toBe(range)
        expect(def?.defaultType).toBe(type)
      })

      it('sections attive', () => {
        const sections = getActiveSections(code)
        for (const section of present) {
          expect(hasSection(sections, section), `attesa presente: ${section}`).toBe(true)
        }
      })

      it('sections assenti', () => {
        const sections = getActiveSections(code)
        for (const section of absent) {
          expect(hasSection(sections, section), `attesa assente: ${section}`).toBe(false)
        }
      })

      it('titolo/metadata centralizzati nel registry: label e description non generici', () => {
        const def = getReportType(code as never)
        expect(def?.label.length).toBeGreaterThan(0)
        expect(def?.label).not.toBe('Report')
        expect(def?.description.length).toBeGreaterThan(10)
      })

      it('table views disponibili', () => {
        expect(getAvailableTableViews(getActiveSections(code))).toEqual(tableViews)
      })

      it('categoryMode', () => {
        expect(getCategoryMode(getActiveSections(code))).toBe(categoryMode)
      })

      it('visibilità filtro "Tipo movimento"', () => {
        expect(shouldShowTypeFilter(getActiveSections(code))).toBe(showTypeFilter)
      })

      it('compatibilità URL: ?tpl=<code> da solo risolve range/type dal registry', () => {
        const params = resolveInitialFilters(new URLSearchParams(`tpl=${code}`), NOW)
        expect(params.get('range')).toBe(range)
        expect(params.get('type')).toBe(type)
      })

      it('URL completo (tpl+range+type espliciti, come da href del template) applica tpl/range/type esattamente', () => {
        const def = getReportType(code as never)!
        const params = resolveInitialFilters(new URLSearchParams(def.href.split('?')[1]), NOW)
        expect(params.get('tpl')).toBe(code)
        expect(params.get('range')).toBe(range)
        expect(params.get('type')).toBe(type)
      })
    })
  }

  it('compatibilità URL legacy: nessun tpl -> tutte le sections, nessun filtro nascosto (comportamento pre-esistente invariato)', () => {
    const sections = getActiveSections(null)
    expect(sections).toBeNull()
    expect(getAvailableTableViews(sections)).toEqual(['monthly', 'categories', 'accounts'])
    expect(getCategoryMode(sections)).toBe('expense')
    expect(shouldShowTypeFilter(sections)).toBe(true)
  })

  it('nessuno dei 10 template condivide lo stesso set di sections di un altro, tranne il gruppo "panoramica completa" per design (MONTHLY/QUARTERLY/ANNUAL/CUSTOM)', () => {
    const overviewCodes = new Set(['MONTHLY', 'QUARTERLY', 'ANNUAL', 'CUSTOM'])
    const signatures = new Map<string, string[]>()
    for (const { code } of MATRIX) {
      const sections = [...(getActiveSections(code) ?? ALL_SECTIONS)].sort()
      const key = sections.join(',')
      const existing = signatures.get(key) ?? []
      existing.push(code)
      signatures.set(key, existing)
    }
    for (const codes of signatures.values()) {
      if (codes.length > 1) {
        expect(new Set(codes)).toEqual(overviewCodes)
      }
    }
  })
})
