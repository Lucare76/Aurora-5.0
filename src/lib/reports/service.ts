import type { SupabaseClient } from '@supabase/supabase-js'

import { computeAdvancedReport, buildReportPeriods } from './calculations'
import type {
  ReportAccountInput,
  ReportCategoryInput,
  ReportFilters,
  ReportPayload,
  ReportRange,
  ReportTransactionInput,
  ReportTransactionTypeFilter,
} from './types'
import { ReportInputError } from './types'

const MAX_CUSTOM_RANGE_DAYS = 366 * 5
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function dateKey(date: Date): string {
  return date.toLocaleDateString('en-CA')
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) || dateKey(date) !== value ? null : date
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function rangeForPreset(range: ReportRange, now = new Date()): { from: string; to: string } {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  switch (range) {
    case 'current-month':
      return { from: dateKey(startOfMonth(today)), to: dateKey(endOfMonth(today)) }
    case 'previous-month': {
      const previous = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      return { from: dateKey(startOfMonth(previous)), to: dateKey(endOfMonth(previous)) }
    }
    case 'last-3-months':
      return { from: dateKey(new Date(today.getFullYear(), today.getMonth() - 2, 1)), to: dateKey(endOfMonth(today)) }
    case 'last-6-months':
      return { from: dateKey(new Date(today.getFullYear(), today.getMonth() - 5, 1)), to: dateKey(endOfMonth(today)) }
    case 'current-year':
      return { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31` }
    case 'previous-year':
      return { from: `${today.getFullYear() - 1}-01-01`, to: `${today.getFullYear() - 1}-12-31` }
    case 'last-12-months':
      return { from: dateKey(new Date(today.getFullYear(), today.getMonth() - 11, 1)), to: dateKey(endOfMonth(today)) }
    case 'custom':
      throw new ReportInputError('INVALID_RANGE', 'Il range custom richiede from e to.')
    default:
      throw new ReportInputError('INVALID_RANGE', 'Range report non valido.')
  }
}

function coerceRange(value: string | null): ReportRange {
  const allowed: ReportRange[] = ['current-month', 'previous-month', 'last-3-months', 'last-6-months', 'current-year', 'previous-year', 'last-12-months', 'custom']
  if (!value) return 'current-month'
  if (!allowed.includes(value as ReportRange)) throw new ReportInputError('INVALID_RANGE', 'Range report non valido.')
  return value as ReportRange
}

function coerceType(value: string | null): ReportTransactionTypeFilter {
  if (!value) return 'both'
  if (value === 'all' || value === 'income' || value === 'expense' || value === 'both') return value
  throw new ReportInputError('INVALID_RANGE', 'Filtro tipo non valido.')
}

function coerceBoolean(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

function validateUuid(value: string | null, code: 'INVALID_ACCOUNT' | 'INVALID_CATEGORY'): string | null {
  if (!value || value === 'all') return null
  if (!UUID_RE.test(value)) throw new ReportInputError(code, 'Identificativo non valido.')
  return value
}

export function parseReportFilters(searchParams: URLSearchParams, now = new Date()): ReportFilters {
  const range = coerceRange(searchParams.get('range'))
  const account = validateUuid(searchParams.get('account'), 'INVALID_ACCOUNT')
  const category = validateUuid(searchParams.get('category'), 'INVALID_CATEGORY')
  const type = coerceType(searchParams.get('type'))
  const includeTransfers = coerceBoolean(searchParams.get('includeTransfers'), false)
  const includeArchivedAccounts = coerceBoolean(searchParams.get('includeArchivedAccounts'), false)
  let from: string
  let to: string

  if (range === 'custom') {
    const fromDate = parseDate(searchParams.get('from') ?? '')
    const toDate = parseDate(searchParams.get('to') ?? '')
    if (!fromDate || !toDate) throw new ReportInputError('INVALID_DATE', 'Date report non valide.')
    if (fromDate > toDate) throw new ReportInputError('INVALID_DATE', 'La data iniziale deve precedere quella finale.')
    const days = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1
    if (days > MAX_CUSTOM_RANGE_DAYS) throw new ReportInputError('RANGE_TOO_LARGE', 'Intervallo massimo consentito: 5 anni.')
    from = dateKey(fromDate)
    to = dateKey(toDate)
  } else {
    const preset = rangeForPreset(range, now)
    from = preset.from
    to = preset.to
  }

  return { range, from, to, account, category, type, includeTransfers, includeArchivedAccounts }
}

function earliestQueryDate(periodFrom: string, previousFrom: string): string {
  return previousFrom < periodFrom ? previousFrom : periodFrom
}

function latestQueryDate(periodTo: string): string {
  const today = dateKey(new Date())
  return today > periodTo ? today : periodTo
}

function assertFilterOwnership(filters: ReportFilters, accounts: ReportAccountInput[], categories: ReportCategoryInput[]) {
  if (filters.account && !accounts.some((account) => account.id === filters.account)) {
    throw new ReportInputError('INVALID_ACCOUNT', 'Conto non disponibile.')
  }
  if (filters.category && !categories.some((category) => category.id === filters.category)) {
    throw new ReportInputError('INVALID_CATEGORY', 'Categoria non disponibile.')
  }
}

export async function buildReportPayload(
  supabase: SupabaseClient,
  searchParams: URLSearchParams,
): Promise<ReportPayload> {
  const filters = parseReportFilters(searchParams)
  const { period, previousPeriod } = buildReportPeriods(filters.from, filters.to)
  const from = earliestQueryDate(period.from, previousPeriod.from)
  const to = latestQueryDate(period.to)

  const [accountsRes, categoriesRes, transactionsRes, recurringRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('id,name,type,balance,currency,color,is_active,is_hidden')
      .order('sort_order', { ascending: true }),
    supabase
      .from('categories')
      .select('id,name,type,color,icon,parent_id')
      .order('sort_order', { ascending: true }),
    supabase
      .from('transactions')
      .select('id,account_id,category_id,type,amount,description,date,transfer_peer_id,recurring_id')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true }),
    supabase
      .from('recurring_rules')
      .select('id')
      .eq('is_active', true),
  ])

  if (accountsRes.error || categoriesRes.error || transactionsRes.error || recurringRes.error) {
    throw new ReportInputError('REPORT_FAILED', 'Report non disponibile.')
  }

  const accounts = (accountsRes.data ?? []) as ReportAccountInput[]
  const categories = (categoriesRes.data ?? []) as ReportCategoryInput[]
  const transactions = (transactionsRes.data ?? []) as ReportTransactionInput[]
  assertFilterOwnership(filters, accounts, categories)

  const computed = computeAdvancedReport({
    accounts,
    categories,
    transactions,
    activeRecurringRulesCount: (recurringRes.data ?? []).length,
    period,
    previousPeriod,
    accountFilter: filters.account,
    categoryFilter: filters.category,
    typeFilter: filters.type,
    includeTransfers: filters.includeTransfers,
    includeArchivedAccounts: filters.includeArchivedAccounts,
  })

  return {
    filters,
    period,
    previousPeriod,
    ...computed,
    metadata: {
      generatedAt: new Date().toISOString(),
      queryCount: 4,
      truncated: false,
      dataCompleteness: 'complete',
      warnings: filters.includeTransfers
        ? ['I trasferimenti sono mostrati separatamente e non alterano entrate, uscite o cash flow.']
        : [],
    },
  }
}
