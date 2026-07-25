import { formatCurrency } from '@/lib/utils'
import type {
  AgendaGroup,
  CalendarAccountBalance,
  CalendarAccountInput,
  CalendarBudgetInput,
  CalendarCategoryInput,
  CalendarDay,
  CalendarEventStatus,
  CalendarGoalInput,
  CalendarLoanInput,
  CalendarRecurringInput,
  CalendarTransactionInput,
  CriticalDay,
  DailyForecastPoint,
  FinancialCalendarEvent,
  FinancialCalendarFilters,
  FinancialCalendarPeriod,
  CalendarInsight,
  ForecastConfidence,
} from './types'

const EVENT_LIMIT = 1000

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function dateKey(date: Date): string {
  return date.toLocaleDateString('en-CA')
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000) + 1
}

function endOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex + 1, 0)
}

function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getDate()
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1)
  target.setDate(Math.min(day, endOfMonth(target.getFullYear(), target.getMonth()).getDate()))
  return target
}

function addFrequency(date: Date, frequency: CalendarRecurringInput['frequency']): Date {
  switch (frequency) {
    case 'daily': return addDays(date, 1)
    case 'weekly': return addDays(date, 7)
    case 'biweekly': return addDays(date, 14)
    case 'monthly': return addMonthsClamped(date, 1)
    case 'quarterly': return addMonthsClamped(date, 3)
    case 'yearly': return addMonthsClamped(date, 12)
  }
}

function categoryName(categoryId: string | null, categories: CalendarCategoryInput[]) {
  if (!categoryId) return null
  const byId = new Map(categories.map((category) => [category.id, category]))
  const category = byId.get(categoryId)
  const parent = category?.parent_id ? byId.get(category.parent_id) : null
  return parent ? `${parent.name} / ${category?.name ?? 'Categoria'}` : category?.name ?? 'Categoria'
}

function accountName(accountId: string | null, accounts: CalendarAccountInput[]) {
  return accountId ? accounts.find((account) => account.id === accountId)?.name ?? null : null
}

export function buildFinancialCalendarPeriod(from: string, to: string): FinancialCalendarPeriod {
  return { from, to, label: `${from} - ${to}`, days: daysBetween(from, to) }
}

export function generateRecurringEvents(params: {
  rules: CalendarRecurringInput[]
  accounts: CalendarAccountInput[]
  categories: CalendarCategoryInput[]
  period: FinancialCalendarPeriod
  today: string
}): FinancialCalendarEvent[] {
  const events: FinancialCalendarEvent[] = []
  for (const rule of params.rules) {
    if (!rule.is_active) continue
    let cursor = parseDate(rule.next_due_date || rule.start_date)
    const periodStart = parseDate(params.period.from)
    const periodEnd = parseDate(params.period.to)
    const end = rule.end_date ? parseDate(rule.end_date) : null
    let guard = 0
    while (cursor < periodStart && guard < 800) {
      const next = addFrequency(cursor, rule.frequency)
      if (next.getTime() === cursor.getTime()) break
      cursor = next
      guard += 1
    }
    while (cursor <= periodEnd && guard < 1200) {
      if (!end || cursor <= end) {
        const date = dateKey(cursor)
        events.push({
          id: `recurring:${rule.id}:${date}`,
          sourceId: rule.id,
          sourceType: 'RECURRING',
          eventType: rule.type === 'income' ? 'EXPECTED_INCOME' : 'EXPECTED_EXPENSE',
          title: rule.description,
          description: rule.auto_create ? 'Ricorrenza con auto-creazione attiva' : 'Ricorrenza prevista',
          date,
          amount: roundMoney(Number(rule.amount)),
          direction: rule.type === 'income' ? 'INCOME' : 'EXPENSE',
          accountId: rule.account_id,
          accountName: accountName(rule.account_id, params.accounts),
          categoryId: rule.category_id,
          categoryName: categoryName(rule.category_id, params.categories),
          status: date < params.today ? 'OVERDUE' : 'EXPECTED',
          confidence: rule.account_id && rule.amount ? 'HIGH' : 'MEDIUM',
          href: '/recurring',
          metadata: { frequency: rule.frequency, autoCreate: rule.auto_create },
        })
      }
      const next = addFrequency(cursor, rule.frequency)
      if (next.getTime() === cursor.getTime()) break
      cursor = next
      guard += 1
    }
  }
  return events
}

export function generateLoanEvents(params: {
  loans: CalendarLoanInput[]
  period: FinancialCalendarPeriod
  today: string
}): FinancialCalendarEvent[] {
  return params.loans
    .filter((loan) => !loan.is_settled && loan.due_date && loan.due_date >= params.period.from && loan.due_date <= params.period.to)
    .map((loan) => {
      const direction = loan.type === 'given' ? 'INCOME' : 'EXPENSE'
      const status: CalendarEventStatus = loan.due_date! < params.today ? 'OVERDUE' : 'EXPECTED'
      return {
        id: `loan:${loan.id}:${loan.due_date}`,
        sourceId: loan.id,
        sourceType: 'LOAN',
        eventType: 'LOAN_INSTALLMENT',
        title: loan.type === 'given' ? `Rientro prestito: ${loan.counterpart}` : `Scadenza prestito: ${loan.counterpart}`,
        description: loan.description,
        date: loan.due_date!,
        amount: roundMoney(Number(loan.remaining)),
        direction,
        accountId: null,
        accountName: null,
        categoryId: null,
        categoryName: null,
        status,
        confidence: 'MEDIUM',
        href: '/loans',
        metadata: { loanType: loan.type, plan: 'Scadenza generale; piano rateale non disponibile' },
      } satisfies FinancialCalendarEvent
    })
}

export function generateGoalEvents(params: {
  goals: CalendarGoalInput[]
  period: FinancialCalendarPeriod
  today: string
}): FinancialCalendarEvent[] {
  return params.goals
    .filter((goal) => !goal.archived && goal.status !== 'COMPLETED' && goal.target_date && goal.target_date >= params.period.from && goal.target_date <= params.period.to)
    .map((goal) => {
      const remaining = Math.max(Number(goal.target_amount) - Number(goal.current_amount), 0)
      return {
        id: `goal:${goal.id}:${goal.target_date}`,
        sourceId: goal.id,
        sourceType: 'SAVINGS_GOAL',
        eventType: 'GOAL_DEADLINE',
        title: `Scadenza obiettivo: ${goal.name}`,
        description: remaining > 0 ? `Importo ancora necessario: ${formatCurrency(remaining)}` : 'Obiettivo coperto',
        date: goal.target_date!,
        amount: roundMoney(remaining),
        direction: 'NEUTRAL',
        accountId: null,
        accountName: null,
        categoryId: null,
        categoryName: null,
        status: goal.target_date! < params.today ? 'OVERDUE' : 'INFORMATIONAL',
        confidence: 'NOT_APPLICABLE',
        href: `/goals/${goal.id}`,
        metadata: { remainingAmount: remaining },
      } satisfies FinancialCalendarEvent
    })
}

export function generateBudgetEvents(params: {
  budgets: CalendarBudgetInput[]
  categories: CalendarCategoryInput[]
  transactions: CalendarTransactionInput[]
  period: FinancialCalendarPeriod
  today: string
}): FinancialCalendarEvent[] {
  return params.budgets
    .map((budget) => {
      const due = dateKey(endOfMonth(budget.year, budget.month - 1))
      if (due < params.period.from || due > params.period.to) return null
      const spent = params.transactions
        .filter((tx) => tx.type === 'expense' && tx.transfer_peer_id === null && tx.category_id === budget.category_id && tx.date.slice(0, 7) === `${budget.year}-${String(budget.month).padStart(2, '0')}`)
        .reduce((total, tx) => total + Number(tx.amount), 0)
      const amount = Number(budget.amount)
      const remaining = roundMoney(amount - spent)
      return {
        id: `budget:${budget.id}:${due}`,
        sourceId: budget.id,
        sourceType: 'BUDGET',
        eventType: 'BUDGET_DEADLINE',
        title: `Chiusura budget: ${categoryName(budget.category_id, params.categories) ?? 'Categoria'}`,
        description: remaining >= 0 ? `Residuo previsto: ${formatCurrency(remaining)}` : `Budget superato di ${formatCurrency(Math.abs(remaining))}`,
        date: due,
        amount: Math.abs(remaining),
        direction: 'NEUTRAL',
        accountId: null,
        accountName: null,
        categoryId: budget.category_id,
        categoryName: categoryName(budget.category_id, params.categories),
        status: due < params.today ? 'COMPLETED' : 'INFORMATIONAL',
        confidence: 'NOT_APPLICABLE',
        href: `/budgets/${budget.id}`,
        metadata: { budgetAmount: amount, spent: roundMoney(spent), remaining },
      } satisfies FinancialCalendarEvent
    })
    .filter(Boolean) as FinancialCalendarEvent[]
}

export function generateActualTransactionEvents(params: {
  transactions: CalendarTransactionInput[]
  accounts: CalendarAccountInput[]
  categories: CalendarCategoryInput[]
}): FinancialCalendarEvent[] {
  return params.transactions.map((tx) => {
    const isTransfer = tx.type === 'transfer' || Boolean(tx.transfer_peer_id)
    return {
      id: `actual:${tx.id}`,
      sourceId: tx.id,
      sourceType: 'EXISTING_TRANSACTION',
      eventType: 'ACTUAL_TRANSACTION',
      title: tx.description || (isTransfer ? 'Trasferimento registrato' : 'Movimento registrato'),
      description: 'Movimento reale già registrato',
      date: tx.date,
      amount: roundMoney(Number(tx.amount)),
      direction: isTransfer ? 'NEUTRAL' : tx.type === 'income' ? 'INCOME' : 'EXPENSE',
      accountId: tx.account_id,
      accountName: accountName(tx.account_id, params.accounts),
      categoryId: tx.category_id,
      categoryName: categoryName(tx.category_id, params.categories),
      status: 'COMPLETED',
      confidence: 'CONFIRMED',
      href: `/transactions?from=${tx.date}&to=${tx.date}`,
      metadata: { transactionType: tx.type, recurringId: tx.recurring_id },
    } satisfies FinancialCalendarEvent
  })
}

export function applyCalendarFilters(events: FinancialCalendarEvent[], filters: FinancialCalendarFilters): FinancialCalendarEvent[] {
  return events.filter((event) => {
    if (filters.account && event.accountId !== filters.account) return false
    if (filters.category && event.categoryId !== filters.category) return false
    if (filters.sourceType !== 'ALL' && event.sourceType !== filters.sourceType) return false
    if (filters.direction !== 'ALL' && event.direction !== filters.direction) return false
    if (filters.status !== 'ALL' && event.status !== filters.status) return false
    if (!filters.includeActual && event.sourceType === 'EXISTING_TRANSACTION') return false
    if (!filters.includeExpected && event.status === 'EXPECTED') return false
    if (!filters.includeInformational && event.direction === 'NEUTRAL') return false
    return true
  })
}

export function computeCalendarForecast(params: {
  accounts: CalendarAccountInput[]
  events: FinancialCalendarEvent[]
  period: FinancialCalendarPeriod
  threshold: number
  today: string
  month: string
}): {
  currentBalances: CalendarAccountBalance[]
  summary: Omit<import('./types').CalendarSummary, 'eventCount' | 'expectedEventCount' | 'actualEventCount' | 'loanDueCount' | 'goalDueCount' | 'budgetDueCount' | 'activeAccountsCount'>
  dailySeries: DailyForecastPoint[]
  calendarDays: CalendarDay[]
  criticalDays: CriticalDay[]
} {
  const activeAccounts = params.accounts.filter((account) => account.is_active)
  const accountBalances = new Map(activeAccounts.map((account) => [account.id, roundMoney(Number(account.balance))]))
  let total = roundMoney([...accountBalances.values()].reduce((sum, value) => sum + value, 0))
  const dailySeries: DailyForecastPoint[] = []
  const calendarDays: CalendarDay[] = []
  const criticalDays: CriticalDay[] = []
  let projectedIncome = 0
  let projectedExpenses = 0
  let min = total
  let max = total
  let minDate: string | null = params.period.from
  let maxDate: string | null = params.period.from
  let daysBelowZero = 0
  let daysBelowThreshold = 0

  const eventsByDate = new Map<string, FinancialCalendarEvent[]>()
  for (const event of params.events) {
    const arr = eventsByDate.get(event.date) ?? []
    arr.push(event)
    eventsByDate.set(event.date, arr)
  }

  for (const event of params.events.filter((item) => item.date < params.period.from && item.status !== 'COMPLETED')) {
    if (event.amount === null || event.direction === 'NEUTRAL') continue
    if (event.direction === 'INCOME') {
      total = roundMoney(total + event.amount)
      if (event.accountId) accountBalances.set(event.accountId, roundMoney((accountBalances.get(event.accountId) ?? 0) + event.amount))
    } else {
      total = roundMoney(total - event.amount)
      if (event.accountId) accountBalances.set(event.accountId, roundMoney((accountBalances.get(event.accountId) ?? 0) - event.amount))
    }
  }
  const openingBalance = total

  for (let cursor = parseDate(params.period.from); dateKey(cursor) <= params.period.to; cursor = addDays(cursor, 1)) {
    const date = dateKey(cursor)
    const opening = total
    const events = (eventsByDate.get(date) ?? []).sort(sortEvents)
    let income = 0
    let expenses = 0
    for (const event of events) {
      if (event.sourceType === 'EXISTING_TRANSACTION' || event.status === 'COMPLETED') continue
      if (event.amount === null || event.direction === 'NEUTRAL') continue
      if (event.direction === 'INCOME') {
        income += event.amount
        if (event.accountId) accountBalances.set(event.accountId, roundMoney((accountBalances.get(event.accountId) ?? 0) + event.amount))
      } else {
        expenses += event.amount
        if (event.accountId) accountBalances.set(event.accountId, roundMoney((accountBalances.get(event.accountId) ?? 0) - event.amount))
      }
    }
    projectedIncome = roundMoney(projectedIncome + income)
    projectedExpenses = roundMoney(projectedExpenses + expenses)
    total = roundMoney(total + income - expenses)
    if (total < min) { min = total; minDate = date }
    if (total > max) { max = total; maxDate = date }
    if (total < 0) daysBelowZero += 1
    if (total < params.threshold) daysBelowThreshold += 1

    const warnings = buildDayWarnings(date, opening, income, expenses, total, events, params.threshold)
    criticalDays.push(...warnings)
    dailySeries.push({
      date,
      label: cursor.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
      totalProjectedBalance: total,
      projectedIncome: income,
      projectedExpenses: expenses,
      threshold: params.threshold,
      accountBalances: Object.fromEntries([...accountBalances.entries()]),
    })
    calendarDays.push({
      date,
      day: cursor.getDate(),
      inCurrentMonth: date.slice(0, 7) === params.month,
      isToday: date === params.today,
      openingBalance: opening,
      income,
      expenses,
      closingBalance: total,
      eventCount: events.length,
      events,
      warnings,
    })
  }

  const currentBalances: CalendarAccountBalance[] = activeAccounts.map((account) => ({
    accountId: account.id,
    accountName: account.name,
    type: account.type,
    currentBalance: roundMoney(Number(account.balance)),
    projectedClosingBalance: roundMoney(accountBalances.get(account.id) ?? Number(account.balance)),
    minimumProjectedBalance: Math.min(...dailySeries.map((point) => point.accountBalances[account.id] ?? Number(account.balance))),
  }))

  return {
    currentBalances,
    summary: {
      openingBalance,
      projectedClosingBalance: total,
      projectedIncome,
      projectedExpenses,
      projectedNetCashFlow: roundMoney(projectedIncome - projectedExpenses),
      minimumProjectedBalance: min,
      minimumProjectedBalanceDate: minDate,
      maximumProjectedBalance: max,
      maximumProjectedBalanceDate: maxDate,
      daysBelowZero,
      daysBelowThreshold,
      firstCriticalDate: criticalDays[0]?.date ?? null,
      missingToStayAboveThreshold: min < params.threshold ? roundMoney(params.threshold - min) : 0,
    },
    dailySeries,
    calendarDays,
    criticalDays,
  }
}

function sortEvents(a: FinancialCalendarEvent, b: FinancialCalendarEvent) {
  const order = { COMPLETED: 0, INCOME: 1, NEUTRAL: 2, EXPENSE: 3 }
  const aOrder = a.status === 'COMPLETED' ? order.COMPLETED : order[a.direction]
  const bOrder = b.status === 'COMPLETED' ? order.COMPLETED : order[b.direction]
  return aOrder - bOrder || (a.amount ?? 0) - (b.amount ?? 0) || a.title.localeCompare(b.title, 'it')
}

function buildDayWarnings(date: string, opening: number, income: number, expenses: number, closing: number, events: FinancialCalendarEvent[], threshold: number): CriticalDay[] {
  const warnings: CriticalDay[] = []
  if (closing < 0) warnings.push({ date, type: 'NEGATIVE_BALANCE', severity: 'DANGER', message: `Saldo previsto sotto zero: ${formatCurrency(closing)}.`, amount: closing })
  else if (closing < threshold) warnings.push({ date, type: 'BELOW_THRESHOLD', severity: 'WARNING', message: `Saldo previsto sotto soglia: ${formatCurrency(closing)}.`, amount: closing })
  if (expenses >= Math.max(500, Math.abs(opening) * 0.1)) warnings.push({ date, type: 'LARGE_EXPENSE', severity: 'WARNING', message: `Uscite previste elevate: ${formatCurrency(expenses)}.`, amount: expenses })
  if (events.filter((event) => event.direction === 'EXPENSE').length >= 3) warnings.push({ date, type: 'MULTIPLE_EXPENSES', severity: 'INFO', message: 'Più scadenze di uscita nello stesso giorno.', amount: null })
  if (events.some((event) => event.sourceType === 'LOAN' && event.status === 'OVERDUE')) warnings.push({ date, type: 'OVERDUE_INSTALLMENT', severity: 'DANGER', message: 'Prestito scaduto o da verificare.', amount: null })
  if (events.some((event) => event.sourceType === 'SAVINGS_GOAL' && Number(event.metadata.remainingAmount ?? 0) > 0)) warnings.push({ date, type: 'GOAL_AT_RISK', severity: 'WARNING', message: 'Obiettivo in scadenza con importo residuo.', amount: null })
  if (events.some((event) => event.direction !== 'NEUTRAL' && !event.accountId)) warnings.push({ date, type: 'UNASSIGNED_ACCOUNT', severity: 'INFO', message: 'Evento senza conto associato.', amount: null })
  return warnings
}

export function buildAgendaGroups(days: CalendarDay[], today: string): AgendaGroup[] {
  const todayDate = parseDate(today)
  const groups: AgendaGroup[] = [
    { key: 'today', label: 'Oggi', days: [] },
    { key: 'tomorrow', label: 'Domani', days: [] },
    { key: 'this-week', label: 'Questa settimana', days: [] },
    { key: 'next-week', label: 'Prossima settimana', days: [] },
    { key: 'later', label: 'Più avanti', days: [] },
  ]
  for (const day of days.filter((item) => item.eventCount > 0 || item.warnings.length > 0)) {
    const diff = Math.round((parseDate(day.date).getTime() - todayDate.getTime()) / 86400000)
    if (diff === 0) groups[0].days.push(day)
    else if (diff === 1) groups[1].days.push(day)
    else if (diff <= 7) groups[2].days.push(day)
    else if (diff <= 14) groups[3].days.push(day)
    else groups[4].days.push(day)
  }
  return groups.filter((group) => group.days.length > 0)
}

export function buildConfidence(events: FinancialCalendarEvent[]): ForecastConfidence {
  const forecastEvents = events.filter((event) => event.status !== 'COMPLETED')
  const unassignedEventsCount = forecastEvents.filter((event) => event.direction !== 'NEUTRAL' && !event.accountId).length
  const missingAmountEventsCount = forecastEvents.filter((event) => event.direction !== 'NEUTRAL' && event.amount === null).length
  const missingAccountEventsCount = unassignedEventsCount
  const totalChecks = Math.max(1, forecastEvents.length * 2)
  const missing = missingAmountEventsCount + missingAccountEventsCount
  const completenessPercentage = Math.max(0, Math.round(((totalChecks - missing) / totalChecks) * 100))
  const forecastConfidence: ForecastConfidence['forecastConfidence'] = completenessPercentage >= 95 ? 'HIGH' : completenessPercentage >= 75 ? 'MEDIUM' : 'LOW'
  const confidenceReasons = [
    'Le ricorrenze attive sono considerate ad alta affidabilità.',
    'I prestiti senza piano rateale generano solo la scadenza generale.',
  ]
  if (missingAccountEventsCount > 0) confidenceReasons.push(`${missingAccountEventsCount} eventi non hanno un conto associato.`)
  if (missingAmountEventsCount > 0) confidenceReasons.push(`${missingAmountEventsCount} eventi non hanno un importo affidabile.`)
  return { forecastConfidence, confidenceReasons, completenessPercentage, unassignedEventsCount, missingAmountEventsCount, missingAccountEventsCount }
}

export function buildInsights(params: {
  events: FinancialCalendarEvent[]
  criticalDays: CriticalDay[]
  summary: { projectedIncome: number; projectedExpenses: number; minimumProjectedBalance: number; minimumProjectedBalanceDate: string | null; daysBelowZero: number; daysBelowThreshold: number }
  confidence: { forecastConfidence: string; unassignedEventsCount: number }
}): CalendarInsight[] {
  const insights: CalendarInsight[] = []
  const negative = params.criticalDays.find((day) => day.type === 'NEGATIVE_BALANCE')
  const below = params.criticalDays.find((day) => day.type === 'BELOW_THRESHOLD')
  const large = params.criticalDays.find((day) => day.type === 'LARGE_EXPENSE')
  const multiple = params.criticalDays.find((day) => day.type === 'MULTIPLE_EXPENSES')
  const goal = params.criticalDays.find((day) => day.type === 'GOAL_AT_RISK')
  if (negative) insights.push({ type: 'NEGATIVE_BALANCE_EXPECTED', severity: 'DANGER', title: 'Saldo sotto zero possibile', message: `${negative.date}: il saldo previsto potrebbe scendere a ${formatCurrency(Number(negative.amount ?? 0))}.` })
  else if (below) insights.push({ type: 'BELOW_THRESHOLD_EXPECTED', severity: 'WARNING', title: 'Soglia a rischio', message: `${below.date}: il saldo previsto potrebbe scendere sotto la soglia configurata.` })
  else insights.push({ type: 'BALANCE_STAYS_POSITIVE', severity: 'INFO', title: 'Saldo previsto positivo', message: `Il saldo previsto rimane sopra ${formatCurrency(params.summary.minimumProjectedBalance)} per tutto il periodo.` })
  if (large) insights.push({ type: 'HIGH_EXPENSE_DAY', severity: 'WARNING', title: 'Giornata con uscite elevate', message: large.message })
  if (multiple) insights.push({ type: 'MULTIPLE_DUE_ITEMS', severity: 'INFO', title: 'Scadenze concentrate', message: multiple.message })
  if (params.summary.projectedIncome >= params.summary.projectedExpenses && params.summary.projectedIncome > 0) insights.push({ type: 'INCOME_COVERS_EXPENSES', severity: 'INFO', title: 'Entrate previste sufficienti', message: 'Le entrate previste coprono le uscite previste nel periodo.' })
  else if (params.summary.projectedExpenses > params.summary.projectedIncome) insights.push({ type: 'EXPENSES_EXCEED_INCOME', severity: 'WARNING', title: 'Uscite previste superiori', message: 'Le uscite previste superano le entrate previste nel periodo.' })
  if (goal) insights.push({ type: 'GOAL_DEADLINE_AT_RISK', severity: 'WARNING', title: 'Obiettivo da verificare', message: goal.message })
  if (params.confidence.forecastConfidence !== 'HIGH') insights.push({ type: 'FORECAST_LOW_CONFIDENCE', severity: 'INFO', title: 'Affidabilità da verificare', message: 'La previsione contiene dati incompleti o scadenze stimate.' })
  if (params.events.length === 0) insights.push({ type: 'NO_UPCOMING_EVENTS', severity: 'INFO', title: 'Nessun evento', message: 'Non ci sono eventi finanziari nel periodo selezionato.' })
  const seen = new Set<string>()
  return insights.filter((item) => {
    if (seen.has(item.type)) return false
    seen.add(item.type)
    return true
  }).slice(0, 5)
}

export function eventLimit() {
  return EVENT_LIMIT
}
