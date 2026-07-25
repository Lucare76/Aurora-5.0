import type { SupabaseClient } from '@supabase/supabase-js'
import {
  applyCalendarFilters,
  buildAgendaGroups,
  buildConfidence,
  buildFinancialCalendarPeriod,
  buildInsights,
  computeCalendarForecast,
  eventLimit,
  generateActualTransactionEvents,
  generateBudgetEvents,
  generateGoalEvents,
  generateLoanEvents,
  generateRecurringEvents,
} from './calculations'
import type {
  CalendarAccountInput,
  CalendarBudgetInput,
  CalendarCategoryInput,
  CalendarDirection,
  CalendarEventStatus,
  CalendarGoalInput,
  CalendarLoanInput,
  CalendarRecurringInput,
  CalendarSourceType,
  CalendarTransactionInput,
  CalendarView,
  FinancialCalendarFilters,
  FinancialCalendarPayload,
} from './types'
import { FinancialCalendarInputError } from './types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_HORIZON_DAYS = 31 * 24

function dateKey(date: Date): string {
  return date.toLocaleDateString('en-CA')
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) || dateKey(date) !== value ? null : date
}

function monthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new FinancialCalendarInputError('INVALID_MONTH', 'Mese non valido.')
  const [year, m] = month.split('-').map(Number)
  if (m < 1 || m > 12) throw new FinancialCalendarInputError('INVALID_MONTH', 'Mese non valido.')
  const from = new Date(year, m - 1, 1)
  const to = new Date(year, m, 0)
  return { from: dateKey(from), to: dateKey(to) }
}

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000) + 1
}

function boolParam(value: string | null, fallback: boolean) {
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

function uuidParam(value: string | null, code: 'INVALID_ACCOUNT' | 'INVALID_CATEGORY') {
  if (!value || value === 'all') return null
  if (!UUID_RE.test(value)) throw new FinancialCalendarInputError(code, 'Identificativo non valido.')
  return value
}

function enumParam<T extends string>(value: string | null, allowed: readonly T[], fallback: T, code = 'INVALID_RANGE' as const): T {
  if (!value) return fallback
  if (allowed.includes(value as T)) return value as T
  throw new FinancialCalendarInputError(code, 'Parametro non valido.')
}

export function parseFinancialCalendarFilters(searchParams: URLSearchParams, now = new Date()): FinancialCalendarFilters {
  const view = enumParam<CalendarView>(searchParams.get('view'), ['month', 'agenda'], 'month')
  const month = searchParams.get('month') ?? dateKey(now).slice(0, 7)
  let from: string
  let to: string
  let range = Number(searchParams.get('range') ?? (view === 'agenda' ? 30 : 0))

  if (view === 'agenda') {
    if (!Number.isFinite(range) || range <= 0) throw new FinancialCalendarInputError('INVALID_RANGE', 'Intervallo agenda non valido.')
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    if (fromParam || toParam) {
      const fromDate = parseDate(fromParam ?? '')
      const toDate = parseDate(toParam ?? '')
      if (!fromDate || !toDate || fromDate > toDate) throw new FinancialCalendarInputError('INVALID_DATE', 'Date non valide.')
      from = dateKey(fromDate)
      to = dateKey(toDate)
      range = daysBetween(from, to)
    } else {
      from = dateKey(now)
      const end = new Date(now)
      end.setDate(end.getDate() + range - 1)
      to = dateKey(end)
    }
  } else {
    const r = monthRange(month)
    from = r.from
    to = r.to
    range = daysBetween(from, to)
  }

  if (range > MAX_HORIZON_DAYS) throw new FinancialCalendarInputError('RANGE_TOO_LARGE', 'Orizzonte massimo: 24 mesi.')

  const threshold = Number(searchParams.get('threshold') ?? 0)
  if (!Number.isFinite(threshold)) throw new FinancialCalendarInputError('INVALID_THRESHOLD', 'Soglia non valida.')

  return {
    view,
    month,
    from,
    to,
    range,
    account: uuidParam(searchParams.get('account'), 'INVALID_ACCOUNT'),
    category: uuidParam(searchParams.get('category'), 'INVALID_CATEGORY'),
    sourceType: enumParam<CalendarSourceType | 'ALL'>(searchParams.get('sourceType'), ['ALL', 'RECURRING', 'LOAN', 'BUDGET', 'SAVINGS_GOAL', 'EXISTING_TRANSACTION'], 'ALL'),
    direction: enumParam<CalendarDirection | 'ALL'>(searchParams.get('direction'), ['ALL', 'INCOME', 'EXPENSE', 'NEUTRAL'], 'ALL'),
    status: enumParam<CalendarEventStatus | 'ALL'>(searchParams.get('status'), ['ALL', 'EXPECTED', 'COMPLETED', 'OVERDUE', 'INFORMATIONAL'], 'ALL'),
    includeActual: boolParam(searchParams.get('includeActual'), true),
    includeExpected: boolParam(searchParams.get('includeExpected'), true),
    includeInformational: boolParam(searchParams.get('includeInformational'), true),
    threshold,
  }
}

function assertOwnership(filters: FinancialCalendarFilters, accounts: CalendarAccountInput[], categories: CalendarCategoryInput[]) {
  if (filters.account && !accounts.some((account) => account.id === filters.account)) {
    throw new FinancialCalendarInputError('INVALID_ACCOUNT', 'Conto non disponibile.')
  }
  if (filters.category && !categories.some((category) => category.id === filters.category)) {
    throw new FinancialCalendarInputError('INVALID_CATEGORY', 'Categoria non disponibile.')
  }
}

export async function buildFinancialCalendarPayload(
  supabase: SupabaseClient,
  searchParams: URLSearchParams,
  userId: string,
): Promise<FinancialCalendarPayload> {
  const filters = parseFinancialCalendarFilters(searchParams)
  const period = buildFinancialCalendarPeriod(filters.from, filters.to)
  const today = dateKey(new Date())
  const generationFrom = today < filters.from ? today : filters.from
  const generationPeriod = buildFinancialCalendarPeriod(generationFrom, filters.to)
  const startYear = Number(filters.from.slice(0, 4))
  const endYear = Number(filters.to.slice(0, 4))

  const [
    profileRes,
    accountsRes,
    categoriesRes,
    recurringRes,
    loansRes,
    goalsRes,
    budgetsRes,
    transactionsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('timezone').eq('id', userId).maybeSingle(),
    supabase.from('accounts').select('id,name,type,balance,currency,is_active,is_hidden').eq('user_id', userId),
    supabase.from('categories').select('id,name,type,icon,parent_id').eq('user_id', userId),
    supabase.from('recurring_rules').select('id,account_id,category_id,type,amount,description,frequency,start_date,end_date,next_due_date,last_run_date,is_active,auto_create').eq('user_id', userId),
    supabase.from('loans').select('id,counterpart,type,amount,remaining,description,due_date,is_settled').eq('user_id', userId),
    supabase.from('savings_goals').select('id,name,target_amount,current_amount,target_date,status,archived').eq('user_id', userId),
    supabase.from('budgets').select('id,category_id,amount,month,year').eq('user_id', userId).gte('year', startYear).lte('year', endYear),
    supabase.from('transactions').select('id,account_id,category_id,type,amount,description,date,transfer_peer_id,recurring_id').eq('user_id', userId).gte('date', filters.from).lte('date', filters.to),
  ])

  const responses = [profileRes, accountsRes, categoriesRes, recurringRes, loansRes, goalsRes, budgetsRes, transactionsRes]
  if (responses.some((res) => res.error)) throw new FinancialCalendarInputError('CALENDAR_FAILED', 'Calendario non disponibile.')

  const accounts = (accountsRes.data ?? []) as CalendarAccountInput[]
  const categories = (categoriesRes.data ?? []) as CalendarCategoryInput[]
  const recurring = (recurringRes.data ?? []) as CalendarRecurringInput[]
  const loans = (loansRes.data ?? []) as CalendarLoanInput[]
  const goals = (goalsRes.data ?? []) as CalendarGoalInput[]
  const budgets = ((budgetsRes.data ?? []) as CalendarBudgetInput[]).filter((budget) => {
    const key = `${budget.year}-${String(budget.month).padStart(2, '0')}`
    return key >= filters.from.slice(0, 7) && key <= filters.to.slice(0, 7)
  })
  const transactions = (transactionsRes.data ?? []) as CalendarTransactionInput[]
  assertOwnership(filters, accounts, categories)

  const allEvents = [
    ...generateRecurringEvents({ rules: recurring, accounts, categories, period: generationPeriod, today }),
    ...generateLoanEvents({ loans, period: generationPeriod, today }),
    ...generateGoalEvents({ goals, period: generationPeriod, today }),
    ...generateBudgetEvents({ budgets, categories, transactions, period: generationPeriod, today }),
    ...generateActualTransactionEvents({ transactions, accounts, categories }),
  ]
  const filteredForecastEvents = applyCalendarFilters(allEvents, filters)
  const periodEvents = filteredForecastEvents.filter((event) => event.date >= period.from && event.date <= period.to)
  const truncated = periodEvents.length > eventLimit()
  const events = periodEvents.slice(0, eventLimit())
  const forecast = computeCalendarForecast({ accounts, events: filteredForecastEvents, period, threshold: filters.threshold, today, month: filters.month })
  const confidence = buildConfidence(events)
  const agendaGroups = buildAgendaGroups(forecast.calendarDays, today)
  const insights = buildInsights({ events, criticalDays: forecast.criticalDays, summary: forecast.summary, confidence })
  const summary = {
    ...forecast.summary,
    eventCount: events.length,
    expectedEventCount: events.filter((event) => event.status === 'EXPECTED').length,
    actualEventCount: events.filter((event) => event.sourceType === 'EXISTING_TRANSACTION').length,
    loanDueCount: events.filter((event) => event.sourceType === 'LOAN').length,
    goalDueCount: events.filter((event) => event.sourceType === 'SAVINGS_GOAL').length,
    budgetDueCount: events.filter((event) => event.sourceType === 'BUDGET').length,
    activeAccountsCount: accounts.filter((account) => account.is_active).length,
  }

  return {
    filters,
    period,
    currentBalances: forecast.currentBalances,
    summary,
    forecast: forecast.summary,
    dailySeries: forecast.dailySeries,
    calendarDays: forecast.calendarDays,
    agendaGroups,
    criticalDays: forecast.criticalDays,
    events,
    insights,
    confidence,
    metadata: {
      generatedAt: new Date().toISOString(),
      timezone: (profileRes.data as { timezone?: string } | null)?.timezone ?? 'Europe/Rome',
      queryCount: 8,
      eventCount: events.length,
      forecastHorizonDays: period.days,
      completeness: confidence.completenessPercentage,
      warnings: truncated ? ['Risposta troncata per limite eventi.'] : [],
      truncated,
    },
  }
}
