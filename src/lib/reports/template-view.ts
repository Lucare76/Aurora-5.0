import { resolveTemplate, type ReportSection } from './registry'
import type { ReportDetailTableView, ReportRange } from './types'

const VALID_RANGES: ReportRange[] = ['current-month', 'previous-month', 'last-3-months', 'last-6-months', 'current-year', 'previous-year', 'last-12-months', 'custom']

function todayKey(now: Date): string {
  return now.toLocaleDateString('en-CA')
}

function defaultFrom(now: Date): string {
  const date = new Date(now)
  date.setMonth(date.getMonth() - 1)
  return date.toLocaleDateString('en-CA')
}

/**
 * Normalizes the report page's query params: tpl-aware range/type defaults, and a
 * valid from/to pair whenever the resolved range is 'custom' — whether that came
 * from an explicit `range=custom` (old manual URL) or from a template whose
 * defaultRange is 'custom' (CUSTOM). This is what used to be missing: opening
 * `/reports?range=custom` (or the CUSTOM template link) with no from/to previously
 * reached the API and failed with INVALID_DATE. Pure function of (params, now) so
 * it's fully testable without a browser.
 */
export function resolveInitialFilters(search: URLSearchParams, now: Date = new Date()): URLSearchParams {
  const params = new URLSearchParams(search)
  const template = resolveTemplate(params.get('tpl'))

  if (!params.get('range')) params.set('range', template?.defaultRange ?? 'current-month')
  if (!VALID_RANGES.includes(params.get('range') as ReportRange)) params.set('range', 'current-month')
  if (!params.get('type')) params.set('type', template?.defaultType ?? 'both')

  if (params.get('range') === 'custom') {
    if (!params.get('from')) params.set('from', defaultFrom(now))
    if (!params.get('to')) params.set('to', todayKey(now))
  }

  return params
}

/**
 * Active sections for the current `tpl`. `null` means "no (usable) template" —
 * callers must treat that as "show everything", which keeps every pre-existing
 * `/reports?range=...&type=...` URL (no tpl) rendering the full report exactly as
 * before. An unknown, hidden, or related-tool `tpl` value resolves the same way
 * (via resolveTemplate), never throwing and never silently rendering a wrong
 * narrow view.
 */
export function getActiveSections(tpl: string | null | undefined): Set<ReportSection> | null {
  const template = resolveTemplate(tpl)
  return template ? new Set(template.sections) : null
}

export function hasSection(sections: Set<ReportSection> | null, section: ReportSection): boolean {
  return sections === null || sections.has(section)
}

const TABLE_VIEW_SECTION: Record<ReportDetailTableView, ReportSection[]> = {
  monthly: ['monthly-series'],
  categories: ['expense-categories', 'income-categories'],
  accounts: ['accounts'],
}

export function getAvailableTableViews(sections: Set<ReportSection> | null): ReportDetailTableView[] {
  const views: ReportDetailTableView[] = ['monthly', 'categories', 'accounts']
  if (sections === null) return views
  return views.filter((view) => TABLE_VIEW_SECTION[view].some((token) => sections.has(token)))
}

export function resolveDefaultTableView(available: ReportDetailTableView[], current: ReportDetailTableView): ReportDetailTableView {
  if (available.includes(current)) return current
  return available[0] ?? 'monthly'
}

/**
 * Which category breakdown(s) the "Categorie" block (chart + table tab) should
 * offer. 'income'/'expense' = exactly one side, no toggle needed (INCOME/EXPENSES,
 * and the pre-existing default for no template / any template with a dedicated
 * income+expense KPI row). 'both' = the template wants full income AND expense
 * category visibility with no KPI row already covering that split (CATEGORIES) —
 * reports/page.tsx renders an inner Uscite/Entrate tab in that case only, so
 * MONTHLY/QUARTERLY/ANNUAL/CUSTOM (which also declare both category sections, but
 * already show income+expense via their KPI row) keep their original expense-first
 * single view unchanged.
 */
export function getCategoryMode(sections: Set<ReportSection> | null): 'income' | 'expense' | 'both' {
  if (sections === null) return 'expense'
  const wantsIncome = sections.has('income-categories')
  const wantsExpense = sections.has('expense-categories')
  if (wantsIncome && !wantsExpense) return 'income'
  if (wantsExpense && !wantsIncome) return 'expense'
  if (wantsIncome && wantsExpense) {
    const hasIncomeExpenseKpis = sections.has('kpi-income') || sections.has('kpi-expenses')
    return hasIncomeExpenseKpis ? 'expense' : 'both'
  }
  return 'expense'
}
