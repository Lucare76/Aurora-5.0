import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildBudgetAlerts,
  buildBudgetForecast,
  buildBudgetInsights,
  computeBudgetEntries,
  computeEnrichedBudgetSummary,
  computeBudgetSummary,
} from '@/lib/budgets/service'
import type { EnrichedBudgetEntry, EnrichedBudgetSummary } from '@/lib/budgets/service'
import { buildGoalSummary } from '@/lib/goals/service'
import type { GoalSummary } from '@/lib/goals/service'

// ── Types ─────────────────────────────────────────────────────────────────

export type DashboardAccount = {
  id: string
  name: string
  type: string
  balance: number
  currency: string
  color: string | null
  icon: string | null
  is_hidden: boolean
}

export type DashboardCategorySpend = {
  id: string
  name: string
  icon: string | null
  color: string | null
  total: number
  count: number
}

export type DashboardTransaction = {
  id: string
  date: string
  description: string | null
  amount: number
  type: 'income' | 'expense' | 'transfer'
  categoryName: string | null
  categoryIcon: string | null
  accountName: string
  transferPeerId: string | null
}

export type DashboardChartPoint = {
  key: string
  month: string
  entrate: number
  uscite: number
}

export type DashboardNetWorthPoint = {
  key: string
  month: string
  netWorth: number
}

export type DashboardInsightType =
  | 'category_up'
  | 'category_down'
  | 'savings_up'
  | 'savings_down'
  | 'best_month'
  | 'worst_month'
  | 'net_worth_up'
  | 'net_worth_down'
  | 'budget_warning'
  | 'daily_avg_down'
  | 'daily_avg_up'

export type DashboardInsight = {
  type: DashboardInsightType
  message: string
}

export type DashboardEndOfMonthForecast = {
  currentBalance: number
  projectedBalance: number
  difference: number
  daysElapsed: number
  daysInMonth: number
  dailyAvgFlow: number
  hasEnoughData: boolean
}

export type DashboardMonthStats = {
  avgDailyExpense: number
  txCount: number
  peakExpenseDay: string | null
  peakExpenseAmount: number
  biggestIncome: number
  biggestExpense: number
  daysElapsed: number
}

export type DashboardMonthRecords = {
  topSpendCategoryName: string | null
  topSpendCategoryAmount: number
  mostUsedAccountName: string | null
  mostUsedAccountTxCount: number
  totalOps: number
}

export type DashboardTimelineEventType =
  | 'month_open'
  | 'biggest_income'
  | 'biggest_expense'
  | 'budget_exceeded'
  | 'month_close'

export type DashboardTimelineEvent = {
  date: string
  type: DashboardTimelineEventType
  label: string
  amount?: number
}

export type DashboardUpcomingRule = {
  id: string
  description: string
  amount: number
  type: string
  next_due_date: string
  frequency: string
  auto_create: boolean
}

export type DashboardUpcomingLoan = {
  id: string
  counterpart: string
  description: string | null
  remaining: number
  due_date: string
  type: 'given' | 'received'
}

export type DashboardUpcomingBirthday = {
  id: string
  name: string
  birth_date: string
  daysUntil: number
  age: number
}

export type DashboardCashFlowDay = {
  day: string
  dayIndex: number
  balance: number
}

export type DashboardPayload = {
  // Patrimonio
  netWorth: number
  netWorthVsPrevMonth: number
  netWorthTrend: DashboardNetWorthPoint[]

  // Cash Flow (mese corrente)
  currentMonth: { year: number; month: number }
  monthIncome: number
  monthExpense: number
  monthBalance: number
  prevMonthIncome: number
  prevMonthExpense: number
  prevMonthBalance: number

  // Previsione fine mese
  endOfMonthForecast: DashboardEndOfMonthForecast

  // Statistiche mese
  monthStats: DashboardMonthStats

  // Record mese
  monthRecords: DashboardMonthRecords

  // Conti
  accounts: DashboardAccount[]

  // Top spese
  topCategories: DashboardCategorySpend[]
  prevTopCategories: DashboardCategorySpend[]

  // Ultimi 3 movimenti
  recentTransactions: DashboardTransaction[]

  // Grafico 6 mesi
  monthlyChart: DashboardChartPoint[]

  // Insight automatici (max 5)
  insights: DashboardInsight[]

  // Budget del mese
  budgetSummary: EnrichedBudgetSummary

  // Obiettivi di risparmio
  goalsSummary: GoalSummary

  // Timeline finanziaria
  timeline: DashboardTimelineEvent[]

  // Scadenze (prossimi 30 giorni)
  upcoming30Rules: DashboardUpcomingRule[]
  upcoming30Loans: DashboardUpcomingLoan[]

  // Proiezione liquidità
  cashFlowProjection: DashboardCashFlowDay[]

  // Compleanni imminenti
  upcomingBirthdays: DashboardUpcomingBirthday[]

  // FirstUse
  firstUseStatus: {
    hasAccount: boolean
    hasCategory: boolean
    hasMovement: boolean
    hasBudget: boolean
  }

  generatedAt: string
}

// ── Internal types ─────────────────────────────────────────────────────────

type TxRow = {
  id: string
  account_id: string
  category_id: string | null
  type: string
  amount: number | string
  description: string | null
  date: string
  transfer_peer_id: string | null
}

type CatRow = {
  id: string
  name: string
  type: string
  color: string | null
  icon: string | null
  parent_id: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

const MONTH_LABELS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function sumAmt(txs: TxRow[]): number {
  return txs.reduce((acc, tx) => acc + Number(tx.amount), 0)
}

function isPureIncome(tx: TxRow): boolean {
  return tx.type === 'income' && tx.transfer_peer_id === null
}

function isPureExpense(tx: TxRow): boolean {
  return tx.type === 'expense' && tx.transfer_peer_id === null
}

function isInMonth(tx: TxRow, year: number, month: number): boolean {
  const d = tx.date
  return Number(d.slice(0, 4)) === year && Number(d.slice(5, 7)) === month
}

function topCategoriesFn(
  expenseTxs: TxRow[],
  catById: Map<string, CatRow>,
  limit: number,
): DashboardCategorySpend[] {
  const totals = new Map<string, { total: number; count: number }>()
  for (const tx of expenseTxs) {
    const key = tx.category_id ?? 'no-category'
    const prev = totals.get(key) ?? { total: 0, count: 0 }
    totals.set(key, { total: prev.total + Number(tx.amount), count: prev.count + 1 })
  }
  return [...totals.entries()]
    .map(([id, { total, count }]) => {
      const cat = id !== 'no-category' ? catById.get(id) : undefined
      return {
        id,
        name: cat?.name ?? 'Senza categoria',
        icon: cat?.icon ?? null,
        color: cat?.color ?? null,
        total: round2(total),
        count,
      }
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

function monthlyChartFn(allTxs: TxRow[], now: Date): DashboardChartPoint[] {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const key = `${year}-${String(month).padStart(2, '0')}`
    const monthTxs = allTxs.filter((tx) => isInMonth(tx, year, month))
    return {
      key,
      month: MONTH_LABELS[d.getMonth()],
      entrate: round2(sumAmt(monthTxs.filter(isPureIncome))),
      uscite:  round2(sumAmt(monthTxs.filter(isPureExpense))),
    }
  })
}

function cashFlowProjectionFn(
  accounts: DashboardAccount[],
  rules: DashboardUpcomingRule[],
  loans: DashboardUpcomingLoan[],
  today: Date,
  in30: Date,
): DashboardCashFlowDay[] {
  const liquidBalance = accounts
    .filter((a) => a.type === 'checking' || a.type === 'cash')
    .reduce((s, a) => s + Number(a.balance), 0)

  const delta = new Map<string, number>()

  for (const rule of rules) {
    const sign = rule.type === 'income' ? 1 : -1
    let cur = new Date(`${rule.next_due_date}T00:00:00`)
    while (cur <= in30) {
      if (cur >= today) {
        const k = cur.toLocaleDateString('en-CA')
        delta.set(k, (delta.get(k) ?? 0) + sign * Number(rule.amount))
      }
      const before = cur.getTime()
      switch (rule.frequency) {
        case 'daily':     cur.setDate(cur.getDate() + 1); break
        case 'weekly':    cur.setDate(cur.getDate() + 7); break
        case 'biweekly':  cur.setDate(cur.getDate() + 14); break
        case 'monthly':   cur.setMonth(cur.getMonth() + 1); break
        case 'quarterly': cur.setMonth(cur.getMonth() + 3); break
        case 'yearly':    cur.setFullYear(cur.getFullYear() + 1); break
        default: break
      }
      if (cur.getTime() === before) break
    }
  }

  for (const loan of loans) {
    const sign = loan.type === 'given' ? 1 : -1
    const k = loan.due_date
    delta.set(k, (delta.get(k) ?? 0) + sign * Number(loan.remaining))
  }

  let running = liquidBalance
  return Array.from({ length: 31 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    if (i > 0) running += delta.get(d.toLocaleDateString('en-CA')) ?? 0
    return {
      day: d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
      dayIndex: i,
      balance: Math.round(running * 100) / 100,
    }
  })
}

// ── Pure compute functions (exported for tests) ────────────────────────────

/** Previsione saldo a fine mese basata sulla media giornaliera del mese corrente. */
export function computeEndOfMonthForecast(
  netWorth: number,
  monthIncome: number,
  monthExpense: number,
  now: Date,
): DashboardEndOfMonthForecast {
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysElapsed  = now.getDate()
  const daysRemaining = daysInMonth - daysElapsed
  const hasEnoughData = daysElapsed >= 3

  if (!hasEnoughData) {
    return {
      currentBalance:   round2(netWorth),
      projectedBalance: round2(netWorth),
      difference:       0,
      daysElapsed,
      daysInMonth,
      dailyAvgFlow:     0,
      hasEnoughData:    false,
    }
  }

  const dailyAvgFlow     = round2((monthIncome - monthExpense) / daysElapsed)
  const projectedBalance = round2(netWorth + dailyAvgFlow * daysRemaining)
  const difference       = round2(projectedBalance - netWorth)

  return { currentBalance: round2(netWorth), projectedBalance, difference, daysElapsed, daysInMonth, dailyAvgFlow, hasEnoughData: true }
}

/** Ricostruisce il patrimonio netto degli ultimi 12 mesi sottraendo i flussi netti all'indietro. */
export function computeNetWorthTrend(
  allTxs: TxRow[],
  currentNetWorth: number,
  now: Date,
): DashboardNetWorthPoint[] {
  // Months oldest → newest
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    return {
      year:  d.getFullYear(),
      month: d.getMonth() + 1,
      key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: MONTH_LABELS[d.getMonth()],
    }
  })

  // Walk backwards from current net worth
  let nw = currentNetWorth
  const points: DashboardNetWorthPoint[] = new Array(12)
  for (let i = 11; i >= 0; i--) {
    const m = months[i]
    points[i] = { key: m.key, month: m.label, netWorth: round2(nw) }
    if (i > 0) {
      const mTxs = allTxs.filter((tx) => isInMonth(tx, m.year, m.month))
      const flow = sumAmt(mTxs.filter(isPureIncome)) - sumAmt(mTxs.filter(isPureExpense))
      nw = round2(nw - flow)
    }
  }
  return points
}

/** Statistiche aggregate del mese corrente. */
export function computeMonthStats(
  curTxs: TxRow[],
  now: Date,
): DashboardMonthStats {
  const daysElapsed     = Math.max(now.getDate(), 1)
  const expenseTxs      = curTxs.filter(isPureExpense)
  const incomeTxs       = curTxs.filter(isPureIncome)
  const monthExpense    = expenseTxs.reduce((s, tx) => s + Number(tx.amount), 0)
  const avgDailyExpense = round2(monthExpense / daysElapsed)

  // Giorno con spesa massima
  const expenseByDay = new Map<string, number>()
  for (const tx of expenseTxs) {
    expenseByDay.set(tx.date, (expenseByDay.get(tx.date) ?? 0) + Number(tx.amount))
  }
  let peakExpenseDay: string | null = null
  let peakExpenseAmount = 0
  for (const [day, amount] of expenseByDay) {
    if (amount > peakExpenseAmount) {
      peakExpenseAmount = amount
      peakExpenseDay    = day
    }
  }

  // Max singola entrata/uscita
  const biggestIncome  = incomeTxs.reduce((m, tx) => Math.max(m, Number(tx.amount)), 0)
  const biggestExpense = expenseTxs.reduce((m, tx) => Math.max(m, Number(tx.amount)), 0)

  return {
    avgDailyExpense,
    txCount:          curTxs.length,
    peakExpenseDay,
    peakExpenseAmount: round2(peakExpenseAmount),
    biggestIncome:     round2(biggestIncome),
    biggestExpense:    round2(biggestExpense),
    daysElapsed,
  }
}

/** Record del mese: top categoria, conto più usato, totale operazioni. */
export function computeMonthRecords(
  curTxs: TxRow[],
  topCats: DashboardCategorySpend[],
  accById: Map<string, { name: string }>,
): DashboardMonthRecords {
  const accountCounts = new Map<string, number>()
  for (const tx of curTxs) {
    accountCounts.set(tx.account_id, (accountCounts.get(tx.account_id) ?? 0) + 1)
  }
  let mostUsedAccountId: string | null = null
  let mostUsedAccountTxCount = 0
  for (const [id, count] of accountCounts) {
    if (count > mostUsedAccountTxCount) {
      mostUsedAccountTxCount = count
      mostUsedAccountId      = id
    }
  }

  return {
    topSpendCategoryName:    topCats[0]?.name ?? null,
    topSpendCategoryAmount:  topCats[0]?.total ?? 0,
    mostUsedAccountName:     mostUsedAccountId ? (accById.get(mostUsedAccountId)?.name ?? null) : null,
    mostUsedAccountTxCount,
    totalOps: curTxs.length,
  }
}

/** Timeline cronologica degli eventi principali del mese (max 10 eventi). */
export function computeTimeline(
  curTxs: TxRow[],
  todayStr: string,
  exceededBudgetNames: Array<{ categoryName: string; spent: number }>,
  currentMonth: { year: number; month: number },
): DashboardTimelineEvent[] {
  const { year, month } = currentMonth
  const mm      = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  const events: DashboardTimelineEvent[] = []

  // Apertura mese
  events.push({ date: `${year}-${mm}-01`, type: 'month_open', label: 'Inizio mese' })

  // Entrata maggiore
  let biggestIncomeTx: TxRow | null = null
  let biggestIncomeAmt = 0
  for (const tx of curTxs) {
    if (isPureIncome(tx) && Number(tx.amount) > biggestIncomeAmt) {
      biggestIncomeAmt = Number(tx.amount)
      biggestIncomeTx  = tx
    }
  }
  if (biggestIncomeTx && biggestIncomeAmt > 0) {
    events.push({
      date:   biggestIncomeTx.date,
      type:   'biggest_income',
      label:  biggestIncomeTx.description ?? 'Entrata maggiore',
      amount: round2(biggestIncomeAmt),
    })
  }

  // Uscita maggiore
  let biggestExpenseTx: TxRow | null = null
  let biggestExpenseAmt = 0
  for (const tx of curTxs) {
    if (isPureExpense(tx) && Number(tx.amount) > biggestExpenseAmt) {
      biggestExpenseAmt = Number(tx.amount)
      biggestExpenseTx  = tx
    }
  }
  if (biggestExpenseTx && biggestExpenseAmt > 0) {
    events.push({
      date:   biggestExpenseTx.date,
      type:   'biggest_expense',
      label:  biggestExpenseTx.description ?? 'Uscita maggiore',
      amount: round2(biggestExpenseAmt),
    })
  }

  // Budget sforati (max 3, usa oggi come data proxy)
  for (const b of exceededBudgetNames.slice(0, 3)) {
    events.push({
      date:   todayStr,
      type:   'budget_exceeded',
      label:  `Budget "${b.categoryName}" sforato`,
      amount: round2(b.spent),
    })
  }

  // Fine mese
  events.push({
    date:  `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
    type:  'month_close',
    label: 'Fine mese',
  })

  return events
    .sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type))
    .slice(0, 10)
}

// ── Insights ───────────────────────────────────────────────────────────────

export function generateInsights(params: {
  monthIncome: number
  monthExpense: number
  prevMonthIncome: number
  prevMonthExpense: number
  topCats: DashboardCategorySpend[]
  prevTopCats: DashboardCategorySpend[]
  chart: DashboardChartPoint[]
  currentKey: string
  netWorthTrend: DashboardNetWorthPoint[]
  budgetSummary: EnrichedBudgetSummary
  monthStats: DashboardMonthStats
  prevMonth: { year: number; month: number }
}): DashboardInsight[] {
  const {
    monthIncome, monthExpense, prevMonthIncome, prevMonthExpense,
    topCats, prevTopCats, chart, currentKey,
    netWorthTrend, budgetSummary, monthStats, prevMonth,
  } = params
  const insights: DashboardInsight[] = []

  // Categorie +/- 25%
  const prevById = new Map(prevTopCats.map((c) => [c.id, c]))
  for (const cat of topCats.slice(0, 3)) {
    if (cat.id === 'no-category' || insights.length >= 2) break
    const prev = prevById.get(cat.id)
    if (!prev || prev.total === 0) continue
    const change = (cat.total - prev.total) / prev.total
    if (change > 0.25) {
      insights.push({ type: 'category_up', message: `${cat.name} aumentata del ${Math.round(change * 100)}% rispetto al mese scorso` })
    } else if (change < -0.25) {
      insights.push({ type: 'category_down', message: `${cat.name} diminuita del ${Math.round(Math.abs(change) * 100)}% rispetto al mese scorso` })
    }
  }

  // Risparmio su/giù
  const curSavings  = monthIncome - monthExpense
  const prevSavings = prevMonthIncome - prevMonthExpense
  if (prevSavings > 0 && curSavings > prevSavings * 1.1) {
    insights.push({ type: 'savings_up', message: 'Risparmio più alto rispetto al mese scorso' })
  } else if (prevSavings > 0 && curSavings < prevSavings * 0.9) {
    insights.push({ type: 'savings_down', message: 'Risparmio più basso rispetto al mese scorso' })
  }

  // Miglior/peggiore mese negli ultimi 6
  if (chart.length >= 3) {
    const nets   = chart.map((m) => ({ key: m.key, net: m.entrate - m.uscite }))
    const sorted = [...nets].sort((a, b) => b.net - a.net)
    if (sorted[0].key === currentKey && sorted[0].net > 0) {
      insights.push({ type: 'best_month', message: 'Miglior mese degli ultimi 6 per risparmio netto' })
    } else if (sorted[sorted.length - 1].key === currentKey && sorted[sorted.length - 1].net < 0) {
      insights.push({ type: 'worst_month', message: 'Mese corrente peggiore degli ultimi 6 per saldo netto' })
    }
  }

  // Patrimonio in crescita/calo vs mese scorso (dai trend a 12 mesi)
  if (netWorthTrend.length >= 2 && insights.length < 5) {
    const cur  = netWorthTrend[netWorthTrend.length - 1].netWorth
    const prev = netWorthTrend[netWorthTrend.length - 2].netWorth
    if (prev > 0 && cur > prev * 1.02) {
      insights.push({ type: 'net_worth_up', message: `Patrimonio cresciuto del ${Math.round(((cur - prev) / prev) * 100)}% rispetto al mese scorso` })
    } else if (prev > 0 && cur < prev * 0.98) {
      insights.push({ type: 'net_worth_down', message: `Patrimonio calato del ${Math.round(((prev - cur) / prev) * 100)}% rispetto al mese scorso` })
    }
  }

  // Budget a rischio
  if (budgetSummary.atRiskCount > 0 && insights.length < 5) {
    const n = budgetSummary.atRiskCount
    insights.push({
      type: 'budget_warning',
      message: budgetSummary.exceededCount > 0
        ? `${budgetSummary.exceededCount} ${budgetSummary.exceededCount === 1 ? 'budget sforato' : 'budget sforati'} questo mese`
        : `${n} ${n === 1 ? 'budget vicino al limite' : 'budget vicini al limite'}`,
    })
  }

  // Media giornaliera spesa su/giù vs mese scorso
  if (prevMonthExpense > 0 && monthStats.daysElapsed >= 5 && insights.length < 5) {
    const prevDaysInMonth   = new Date(prevMonth.year, prevMonth.month, 0).getDate()
    const prevAvgDaily      = prevMonthExpense / prevDaysInMonth
    const curAvgDaily       = monthStats.avgDailyExpense
    if (curAvgDaily < prevAvgDaily * 0.85) {
      insights.push({ type: 'daily_avg_down', message: `Spesa giornaliera media inferiore del ${Math.round(((prevAvgDaily - curAvgDaily) / prevAvgDaily) * 100)}% rispetto al mese scorso` })
    } else if (curAvgDaily > prevAvgDaily * 1.15) {
      insights.push({ type: 'daily_avg_up', message: `Spesa giornaliera media superiore del ${Math.round(((curAvgDaily - prevAvgDaily) / prevAvgDaily) * 100)}% rispetto al mese scorso` })
    }
  }

  return insights.slice(0, 5)
}

// ── Main service ───────────────────────────────────────────────────────────

export async function buildDashboardPayload(supabase: SupabaseClient): Promise<DashboardPayload> {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const currentMonth = { year: now.getFullYear(), month: now.getMonth() + 1 }
  const prevDate     = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonth    = { year: prevDate.getFullYear(), month: prevDate.getMonth() + 1 }

  // Extend to 12 months for net-worth trend
  const twelveMonthsAgo    = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const twelveMonthsAgoStr = twelveMonthsAgo.toLocaleDateString('en-CA')
  const todayStr           = now.toLocaleDateString('en-CA')
  const in30               = new Date(now)
  in30.setDate(now.getDate() + 30)
  const in30Str = in30.toLocaleDateString('en-CA')

  const [
    accountsRes,
    categoriesRes,
    txRes,
    budgetsRes,
    goalsRes,
    rulesRes,
    loansRes,
    birthdaysRes,
  ] = await Promise.all([
    supabase
      .from('accounts')
      .select('id,name,type,balance,currency,color,icon,is_active,is_hidden')
      .eq('is_active', true),
    supabase
      .from('categories')
      .select('id,name,type,color,icon,parent_id'),
    supabase
      .from('transactions')
      .select('id,account_id,category_id,type,amount,description,date,transfer_peer_id')
      .gte('date', twelveMonthsAgoStr)
      .order('date', { ascending: false }),
    supabase
      .from('budgets')
      .select('id,category_id,amount')
      .eq('month', currentMonth.month)
      .eq('year', currentMonth.year),
    supabase
      .from('savings_goals')
      .select('id,user_id,name,target_amount,current_amount,target_date,icon,color,notes,status,archived,created_at,updated_at')
      .neq('status', 'ARCHIVED'),
    supabase
      .from('recurring_rules')
      .select('id,description,amount,type,next_due_date,frequency,auto_create')
      .eq('is_active', true)
      .gte('next_due_date', todayStr)
      .lte('next_due_date', in30Str)
      .order('next_due_date', { ascending: true }),
    supabase
      .from('loans')
      .select('id,counterpart,description,remaining,due_date,type')
      .eq('is_settled', false)
      .not('due_date', 'is', null)
      .gte('due_date', todayStr)
      .lte('due_date', in30Str)
      .order('due_date', { ascending: true }),
    supabase
      .from('birthdays')
      .select('id,name,birth_date'),
  ])

  const accounts    = (accountsRes.data ?? []) as DashboardAccount[]
  const categories  = (categoriesRes.data ?? []) as CatRow[]
  const allTxs      = (txRes.data ?? []) as TxRow[]
  const budgets     = (budgetsRes.data ?? []) as { id: string; category_id: string; amount: number }[]
  const goals       = (goalsRes.data ?? []) as any[]
  const rules       = (rulesRes.data ?? []) as DashboardUpcomingRule[]
  const loans       = (loansRes.data ?? []) as DashboardUpcomingLoan[]
  const birthdaysRaw = (birthdaysRes.data ?? []) as { id: string; name: string; birth_date: string }[]

  const catById = new Map<string, CatRow>(categories.map((c) => [c.id, c]))
  const accById = new Map(accounts.map((a) => [a.id, a]))

  const curTxs  = allTxs.filter((tx) => isInMonth(tx, currentMonth.year, currentMonth.month))
  const prevTxs = allTxs.filter((tx) => isInMonth(tx, prevMonth.year, prevMonth.month))

  const monthIncome      = round2(sumAmt(curTxs.filter(isPureIncome)))
  const monthExpense     = round2(sumAmt(curTxs.filter(isPureExpense)))
  const prevMonthIncome  = round2(sumAmt(prevTxs.filter(isPureIncome)))
  const prevMonthExpense = round2(sumAmt(prevTxs.filter(isPureExpense)))

  const netWorth             = round2(accounts.reduce((s, a) => s + Number(a.balance), 0))
  const netWorthVsPrevMonth  = round2(monthIncome - monthExpense)

  const topCats     = topCategoriesFn(curTxs.filter(isPureExpense), catById, 5)
  const prevTopCats = topCategoriesFn(prevTxs.filter(isPureExpense), catById, 5)

  const chart      = monthlyChartFn(allTxs, now)
  const currentKey = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}`

  const recentTransactions: DashboardTransaction[] = allTxs.slice(0, 3).map((tx) => ({
    id:             tx.id,
    date:           tx.date,
    description:    tx.description,
    amount:         Number(tx.amount),
    type:           (tx.transfer_peer_id ? 'transfer' : tx.type) as 'income' | 'expense' | 'transfer',
    categoryName:   tx.category_id ? (catById.get(tx.category_id)?.name ?? null) : null,
    categoryIcon:   tx.category_id ? (catById.get(tx.category_id)?.icon ?? null) : null,
    accountName:    accById.get(tx.account_id)?.name ?? 'Conto sconosciuto',
    transferPeerId: tx.transfer_peer_id,
  }))

  const budgetEntries = computeBudgetEntries(
    budgets, categories, curTxs.filter(isPureExpense), currentMonth.year, currentMonth.month,
  )
  const baseBudgetSummary = computeBudgetSummary(budgetEntries)

  // Enrich budget entries with forecast + comparison (prev month already in allTxs)
  const { childrenOf: bChildrenOf, catById: bCatById } = (() => {
    const co = new Map<string, string[]>()
    for (const c of categories) {
      if ((c as any).parent_id) {
        const arr = co.get((c as any).parent_id) ?? []
        arr.push(c.id)
        co.set((c as any).parent_id, arr)
      }
    }
    return { childrenOf: co, catById: new Map(categories.map((c) => [c.id, c])) }
  })()

  const prevExpTxs = prevTxs.filter(isPureExpense)
  const prevSpentByRawCat: Record<string, number> = {}
  for (const tx of prevExpTxs) {
    if (!tx.category_id) continue
    prevSpentByRawCat[tx.category_id] = (prevSpentByRawCat[tx.category_id] ?? 0) + Number(tx.amount)
  }

  const budgetForecasts = new Map()
  const budgetEnriched: EnrichedBudgetEntry[] = budgetEntries.map((entry) => {
    const forecast = buildBudgetForecast(entry.spent, entry.amount, entry.year, entry.month, now)
    budgetForecasts.set(entry.categoryId, forecast)

    const cat    = bCatById.get(entry.categoryId) as any
    const isRoot = !cat?.parent_id

    let prevSpent = prevSpentByRawCat[entry.categoryId] ?? 0
    if (isRoot) {
      for (const childId of bChildrenOf.get(entry.categoryId) ?? []) {
        prevSpent += prevSpentByRawCat[childId] ?? 0
      }
    }

    const comparison = { prevMonthSpent: prevSpent, currentMonthSpent: entry.spent, absoluteDiff: entry.spent - prevSpent, percentageDiff: prevSpent > 0 ? Math.round(((entry.spent - prevSpent) / prevSpent) * 100) : 0, trend: (prevSpent === 0 ? (entry.spent === 0 ? 'stable' : 'unavailable') : Math.abs(entry.spent - prevSpent) / prevSpent < 0.03 ? 'stable' : entry.spent > prevSpent ? 'up' : 'down') as 'up' | 'down' | 'stable' | 'unavailable' }
    return { ...entry, forecast, comparison, topAlert: null }
  })

  const budgetAlerts   = buildBudgetAlerts(budgetEnriched, budgetForecasts)
  const budgetInsights = buildBudgetInsights(budgetEnriched, 3)
  const budgetSummary  = computeEnrichedBudgetSummary(baseBudgetSummary, budgetEnriched, budgetAlerts, budgetInsights)
  const goalsSummary   = buildGoalSummary(goals)

  // ── New Sprint 7W computations ──────────────────────────────────────────

  const netWorthTrend      = computeNetWorthTrend(allTxs, netWorth, now)
  const endOfMonthForecast = computeEndOfMonthForecast(netWorth, monthIncome, monthExpense, now)
  const monthStats         = computeMonthStats(curTxs, now)
  const monthRecords       = computeMonthRecords(curTxs, topCats, accById)

  const exceededBudgets = budgetEntries
    .filter((e) => e.status === 'exceeded')
    .map((e) => ({ categoryName: e.categoryName, spent: e.spent }))

  const timeline = computeTimeline(curTxs, todayStr, exceededBudgets, currentMonth)

  const insights = generateInsights({
    monthIncome, monthExpense, prevMonthIncome, prevMonthExpense,
    topCats, prevTopCats, chart, currentKey,
    netWorthTrend, budgetSummary, monthStats, prevMonth,
  })

  // ── Birthdays ───────────────────────────────────────────────────────────

  const today2 = new Date()
  today2.setHours(0, 0, 0, 0)
  const upcomingBirthdays: DashboardUpcomingBirthday[] = birthdaysRaw
    .map((b) => {
      const birth = new Date(`${b.birth_date}T00:00:00`)
      let next    = new Date(today2.getFullYear(), birth.getMonth(), birth.getDate())
      if (next < today2) next = new Date(today2.getFullYear() + 1, birth.getMonth(), birth.getDate())
      const daysUntil = Math.round((next.getTime() - today2.getTime()) / 86400000)
      return { ...b, daysUntil, age: next.getFullYear() - birth.getFullYear() }
    })
    .filter((b) => b.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5)

  const cashFlow = cashFlowProjectionFn(accounts, rules, loans, now, in30)

  return {
    netWorth,
    netWorthVsPrevMonth,
    netWorthTrend,
    accounts,
    currentMonth,
    monthIncome,
    monthExpense,
    monthBalance:    round2(monthIncome - monthExpense),
    prevMonthIncome,
    prevMonthExpense,
    prevMonthBalance: round2(prevMonthIncome - prevMonthExpense),
    endOfMonthForecast,
    monthStats,
    monthRecords,
    topCategories:     topCats,
    prevTopCategories: prevTopCats,
    recentTransactions,
    monthlyChart: chart,
    insights,
    budgetSummary,
    goalsSummary,
    timeline,
    upcoming30Rules:     rules,
    upcoming30Loans:     loans,
    cashFlowProjection:  cashFlow,
    upcomingBirthdays,
    firstUseStatus: {
      hasAccount:  accounts.length > 0,
      hasCategory: categories.length > 0,
      hasMovement: allTxs.length > 0,
      hasBudget:   budgets.length > 0,
    },
    generatedAt: new Date().toISOString(),
  }
}
