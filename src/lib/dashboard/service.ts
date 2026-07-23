import type { SupabaseClient } from '@supabase/supabase-js'
import { computeBudgetEntries, computeBudgetSummary } from '@/lib/budgets/service'
import type { BudgetSummary } from '@/lib/budgets/service'

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

export type DashboardInsightType =
  | 'category_up'
  | 'category_down'
  | 'savings_up'
  | 'savings_down'
  | 'best_month'
  | 'worst_month'

export type DashboardInsight = {
  type: DashboardInsightType
  message: string
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

  // Cash Flow (mese corrente)
  currentMonth: { year: number; month: number }
  monthIncome: number
  monthExpense: number
  monthBalance: number
  prevMonthIncome: number
  prevMonthExpense: number
  prevMonthBalance: number

  // Conti
  accounts: DashboardAccount[]

  // Top spese
  topCategories: DashboardCategorySpend[]
  prevTopCategories: DashboardCategorySpend[]

  // Ultimi 10 movimenti
  recentTransactions: DashboardTransaction[]

  // Grafico 6 mesi
  monthlyChart: DashboardChartPoint[]

  // Insight automatici
  insights: DashboardInsight[]

  // Budget del mese
  budgetSummary: BudgetSummary

  // Scadenze (prossimi 30 giorni)
  upcoming30Rules: DashboardUpcomingRule[]
  upcoming30Loans: DashboardUpcomingLoan[]

  // Proiezione liquidità
  cashFlowProjection: DashboardCashFlowDay[]

  // Compleanni imminenti (precomputed)
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
  const d = tx.date // 'YYYY-MM-DD'
  return (
    Number(d.slice(0, 4)) === year &&
    Number(d.slice(5, 7)) === month
  )
}

function topCategories(
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

function monthlyChart(allTxs: TxRow[], now: Date): DashboardChartPoint[] {
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

function cashFlowProjection(
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

function generateInsights(params: {
  monthIncome: number
  monthExpense: number
  prevMonthIncome: number
  prevMonthExpense: number
  topCats: DashboardCategorySpend[]
  prevTopCats: DashboardCategorySpend[]
  chart: DashboardChartPoint[]
  currentKey: string
}): DashboardInsight[] {
  const { monthIncome, monthExpense, prevMonthIncome, prevMonthExpense, topCats, prevTopCats, chart, currentKey } = params
  const insights: DashboardInsight[] = []

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

  const curSavings = monthIncome - monthExpense
  const prevSavings = prevMonthIncome - prevMonthExpense
  if (prevSavings > 0 && curSavings > prevSavings * 1.1) {
    insights.push({ type: 'savings_up', message: 'Risparmio più alto rispetto al mese scorso' })
  } else if (prevSavings > 0 && curSavings < prevSavings * 0.9) {
    insights.push({ type: 'savings_down', message: 'Risparmio più basso rispetto al mese scorso' })
  }

  if (chart.length >= 3) {
    const nets = chart.map((m) => ({ key: m.key, net: m.entrate - m.uscite }))
    const sorted = [...nets].sort((a, b) => b.net - a.net)
    if (sorted[0].key === currentKey && sorted[0].net > 0) {
      insights.push({ type: 'best_month', message: 'Miglior mese degli ultimi 6 per risparmio netto' })
    } else if (sorted[sorted.length - 1].key === currentKey && sorted[sorted.length - 1].net < 0) {
      insights.push({ type: 'worst_month', message: 'Mese corrente peggiore degli ultimi 6 per saldo netto' })
    }
  }

  return insights.slice(0, 4)
}

// ── Main service ───────────────────────────────────────────────────────────

export async function buildDashboardPayload(supabase: SupabaseClient): Promise<DashboardPayload> {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const currentMonth = { year: now.getFullYear(), month: now.getMonth() + 1 }
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonth = { year: prevDate.getFullYear(), month: prevDate.getMonth() + 1 }

  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const sixMonthsAgoStr = sixMonthsAgo.toLocaleDateString('en-CA')
  const todayStr = now.toLocaleDateString('en-CA')
  const in30 = new Date(now)
  in30.setDate(now.getDate() + 30)
  const in30Str = in30.toLocaleDateString('en-CA')

  const [
    accountsRes,
    categoriesRes,
    txRes,
    budgetsRes,
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
      .gte('date', sixMonthsAgoStr)
      .order('date', { ascending: false }),
    supabase
      .from('budgets')
      .select('id,category_id,amount')
      .eq('month', currentMonth.month)
      .eq('year', currentMonth.year),
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

  const accounts = (accountsRes.data ?? []) as DashboardAccount[]
  const categories = (categoriesRes.data ?? []) as CatRow[]
  const allTxs = (txRes.data ?? []) as TxRow[]
  const budgets = (budgetsRes.data ?? []) as { id: string; category_id: string; amount: number }[]
  const rules = (rulesRes.data ?? []) as DashboardUpcomingRule[]
  const loans = (loansRes.data ?? []) as DashboardUpcomingLoan[]
  const birthdaysRaw = (birthdaysRes.data ?? []) as { id: string; name: string; birth_date: string }[]

  const catById = new Map<string, CatRow>(categories.map((c) => [c.id, c]))
  const accById = new Map(accounts.map((a) => [a.id, a]))

  const curTxs  = allTxs.filter((tx) => isInMonth(tx, currentMonth.year, currentMonth.month))
  const prevTxs = allTxs.filter((tx) => isInMonth(tx, prevMonth.year, prevMonth.month))

  const monthIncome      = round2(sumAmt(curTxs.filter(isPureIncome)))
  const monthExpense     = round2(sumAmt(curTxs.filter(isPureExpense)))
  const prevMonthIncome  = round2(sumAmt(prevTxs.filter(isPureIncome)))
  const prevMonthExpense = round2(sumAmt(prevTxs.filter(isPureExpense)))

  const netWorth = round2(accounts.reduce((s, a) => s + Number(a.balance), 0))
  const netWorthVsPrevMonth = round2(monthIncome - monthExpense)

  const topCats     = topCategories(curTxs.filter(isPureExpense), catById, 5)
  const prevTopCats = topCategories(prevTxs.filter(isPureExpense), catById, 5)

  const chart = monthlyChart(allTxs, now)

  const currentKey = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}`
  const insights = generateInsights({
    monthIncome, monthExpense, prevMonthIncome, prevMonthExpense,
    topCats, prevTopCats, chart, currentKey,
  })

  const recentTransactions: DashboardTransaction[] = allTxs.slice(0, 3).map((tx) => ({
    id: tx.id,
    date: tx.date,
    description: tx.description,
    amount: Number(tx.amount),
    type: (tx.transfer_peer_id ? 'transfer' : tx.type) as 'income' | 'expense' | 'transfer',
    categoryName: tx.category_id ? (catById.get(tx.category_id)?.name ?? null) : null,
    categoryIcon: tx.category_id ? (catById.get(tx.category_id)?.icon ?? null) : null,
    accountName:  accById.get(tx.account_id)?.name ?? 'Conto sconosciuto',
    transferPeerId: tx.transfer_peer_id,
  }))

  const budgetEntries = computeBudgetEntries(
    budgets,
    categories,
    curTxs.filter(isPureExpense),
    currentMonth.year,
    currentMonth.month,
  )
  const budgetSummary = computeBudgetSummary(budgetEntries)

  const today2 = new Date()
  today2.setHours(0, 0, 0, 0)
  const upcomingBirthdays: DashboardUpcomingBirthday[] = birthdaysRaw
    .map((b) => {
      const birth = new Date(`${b.birth_date}T00:00:00`)
      let next = new Date(today2.getFullYear(), birth.getMonth(), birth.getDate())
      if (next < today2) next = new Date(today2.getFullYear() + 1, birth.getMonth(), birth.getDate())
      const daysUntil = Math.round((next.getTime() - today2.getTime()) / 86400000)
      return { ...b, daysUntil, age: next.getFullYear() - birth.getFullYear() }
    })
    .filter((b) => b.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5)

  const cashFlow = cashFlowProjection(accounts, rules, loans, now, in30)

  return {
    netWorth,
    netWorthVsPrevMonth,
    accounts,
    currentMonth,
    monthIncome,
    monthExpense,
    monthBalance: round2(monthIncome - monthExpense),
    prevMonthIncome,
    prevMonthExpense,
    prevMonthBalance: round2(prevMonthIncome - prevMonthExpense),
    topCategories: topCats,
    prevTopCategories: prevTopCats,
    recentTransactions,
    monthlyChart: chart,
    insights,
    budgetSummary,
    upcoming30Rules: rules,
    upcoming30Loans: loans,
    cashFlowProjection: cashFlow,
    upcomingBirthdays,
    firstUseStatus: {
      hasAccount:  accounts.length > 0,
      hasCategory: categories.filter((c) => !c.type || true).length > 0,
      hasMovement: allTxs.length > 0,
      hasBudget:   budgets.length > 0,
    },
    generatedAt: new Date().toISOString(),
  }
}
