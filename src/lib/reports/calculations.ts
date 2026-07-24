import {
  calculateTransferTotal,
  isCountableExpense,
  isCountableIncome,
  roundMoney,
} from '@/domain/accounting/aggregations'
import { adaptTransactionRows, type AppTransaction } from '@/domain/accounting/transaction-adapter'
import type { Account, Category, Transaction } from '@/types/database'

import type {
  ReportAccountInput,
  ReportAccountRow,
  ReportCategoryInput,
  ReportCategoryRow,
  ReportComparison,
  ReportComparisonMetric,
  ReportFixedVariable,
  ReportInsight,
  ReportInsightSeverity,
  ReportMonthlyPoint,
  ReportNetWorth,
  ReportPeriod,
  ReportRecords,
  ReportSummary,
  ReportTransactionInput,
  ReportTrend,
} from './types'

const MONTH_LABELS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const UNCATEGORIZED_ID = 'no-category'

function toNumber(value: number | string): number {
  return Number(value)
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

function dateKey(date: Date): string {
  return date.toLocaleDateString('en-CA')
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function isInPeriod(tx: AppTransaction | ReportTransactionInput, period: Pick<ReportPeriod, 'from' | 'to'>): boolean {
  return tx.date >= period.from && tx.date <= period.to
}

function sum(values: number[]): number {
  return roundMoney(values.reduce((total, value) => total + value, 0))
}

function countableIncome(txs: AppTransaction[]): AppTransaction[] {
  return txs.filter(isCountableIncome)
}

function countableExpenses(txs: AppTransaction[]): AppTransaction[] {
  return txs.filter(isCountableExpense)
}

function calculateSavingsRate(income: number, expenses: number): number | null {
  if (income <= 0) return null
  return roundMoney(((income - expenses) / income) * 100)
}

function activeAccounts(accounts: ReportAccountInput[], includeArchivedAccounts: boolean): ReportAccountInput[] {
  return accounts.filter((account) => includeArchivedAccounts || account.is_active)
}

function netWorth(accounts: ReportAccountInput[], includeArchivedAccounts: boolean): number {
  return roundMoney(
    activeAccounts(accounts, includeArchivedAccounts).reduce((total, account) => total + toNumber(account.balance), 0),
  )
}

function cashFlow(txs: AppTransaction[]): number {
  return roundMoney(sum(countableIncome(txs).map((tx) => tx.amount)) - sum(countableExpenses(txs).map((tx) => tx.amount)))
}

function flowAfter(txs: AppTransaction[], afterDate: string): number {
  return cashFlow(txs.filter((tx) => tx.date > afterDate))
}

function periodMonthCount(period: ReportPeriod): number {
  const start = parseDate(period.from)
  const end = parseDate(period.to)
  return Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1)
}

export function buildReportPeriods(from: string, to: string): { period: ReportPeriod; previousPeriod: ReportPeriod } {
  const start = parseDate(from)
  const end = parseDate(to)
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
  const prevEnd = addDays(start, -1)
  const prevStart = addDays(prevEnd, -(days - 1))
  return {
    period: { from, to, label: `${from} - ${to}`, days },
    previousPeriod: {
      from: dateKey(prevStart),
      to: dateKey(prevEnd),
      label: `${dateKey(prevStart)} - ${dateKey(prevEnd)}`,
      days,
    },
  }
}

export function compareMetric(
  currentValue: number | null,
  previousValue: number | null,
  positiveWhen: 'up' | 'down',
): ReportComparisonMetric {
  if (currentValue === null || previousValue === null) {
    return { currentValue, previousValue, absoluteChange: null, percentageChange: null, trend: 'NOT_AVAILABLE', interpretation: 'unavailable' }
  }

  const absoluteChange = roundMoney(currentValue - previousValue)
  const percentageChange = previousValue === 0 ? null : roundMoney((absoluteChange / Math.abs(previousValue)) * 100)
  let trend: ReportTrend = 'NOT_AVAILABLE'
  if (previousValue === 0 && currentValue === 0) trend = 'STABLE'
  else if (previousValue === 0) trend = 'NOT_AVAILABLE'
  else if (Math.abs((currentValue - previousValue) / previousValue) < 0.03) trend = 'STABLE'
  else trend = currentValue > previousValue ? 'UP' : 'DOWN'

  const interpretation =
    trend === 'STABLE' ? 'neutral'
      : trend === 'NOT_AVAILABLE' ? 'unavailable'
        : positiveWhen === 'up'
          ? trend === 'UP' ? 'positive' : 'negative'
          : trend === 'DOWN' ? 'positive' : 'negative'

  return { currentValue, previousValue, absoluteChange, percentageChange, trend, interpretation }
}

export function buildMonthlySeries(
  txs: AppTransaction[],
  period: ReportPeriod,
  currentNetWorth: number,
): ReportMonthlyPoint[] {
  const start = new Date(parseDate(period.from).getFullYear(), parseDate(period.from).getMonth(), 1)
  const end = new Date(parseDate(period.to).getFullYear(), parseDate(period.to).getMonth(), 1)
  const points: ReportMonthlyPoint[] = []
  let cumulativeCashFlow = 0
  let cursor = start

  while (cursor <= end) {
    const key = monthKey(cursor)
    const monthFrom = dateKey(cursor)
    const monthTo = dateKey(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0))
    const monthTxs = txs.filter((tx) => tx.date.slice(0, 7) === key && isInPeriod(tx, period))
    const income = sum(countableIncome(monthTxs).map((tx) => tx.amount))
    const expenses = sum(countableExpenses(monthTxs).map((tx) => tx.amount))
    const monthCashFlow = roundMoney(income - expenses)
    cumulativeCashFlow = roundMoney(cumulativeCashFlow + monthCashFlow)
    const effectiveMonthTo = monthTo > period.to ? period.to : monthTo
    const netWorthAtMonthEnd = roundMoney(currentNetWorth - flowAfter(txs, effectiveMonthTo))

    points.push({
      key,
      month: MONTH_LABELS[cursor.getMonth()],
      from: monthFrom < period.from ? period.from : monthFrom,
      to: effectiveMonthTo,
      income,
      expenses,
      cashFlow: monthCashFlow,
      savingsRate: calculateSavingsRate(income, expenses),
      transactionCount: monthTxs.length,
      cumulativeCashFlow,
      netWorth: netWorthAtMonthEnd,
    })

    cursor = addMonths(cursor, 1)
  }

  return points
}

function categoryDisplay(categoryId: string, categories: ReportCategoryInput[]) {
  if (categoryId === UNCATEGORIZED_ID) {
    return { id: categoryId, name: 'Senza categoria', parentCategory: null, color: '#94a3b8', icon: null }
  }
  const byId = new Map(categories.map((category) => [category.id, category]))
  const category = byId.get(categoryId)
  const parent = category?.parent_id ? byId.get(category.parent_id) : null
  return {
    id: categoryId,
    name: category?.name ?? 'Categoria eliminata',
    parentCategory: parent?.name ?? null,
    color: category?.color ?? '#94a3b8',
    icon: category?.icon ?? null,
  }
}

function rootCategoryId(categoryId: string | null, categories: ReportCategoryInput[]): string {
  if (!categoryId) return UNCATEGORIZED_ID
  const byId = new Map(categories.map((category) => [category.id, category]))
  const category = byId.get(categoryId)
  return category?.parent_id ?? category?.id ?? UNCATEGORIZED_ID
}

function categoryRows(
  currentTxs: AppTransaction[],
  previousTxs: AppTransaction[],
  categories: ReportCategoryInput[],
  mode: 'income' | 'expense',
): ReportCategoryRow[] {
  const current = new Map<string, { amount: number; count: number; children: Map<string, { amount: number; count: number }> }>()
  const previous = new Map<string, number>()
  const filterFn = mode === 'income' ? isCountableIncome : isCountableExpense

  for (const tx of previousTxs.filter(filterFn)) {
    const root = rootCategoryId(tx.categoryId, categories)
    previous.set(root, roundMoney((previous.get(root) ?? 0) + tx.amount))
  }

  for (const tx of currentTxs.filter(filterFn)) {
    const root = rootCategoryId(tx.categoryId, categories)
    const entry = current.get(root) ?? { amount: 0, count: 0, children: new Map() }
    entry.amount = roundMoney(entry.amount + tx.amount)
    entry.count += 1
    if (tx.categoryId && tx.categoryId !== root) {
      const child = entry.children.get(tx.categoryId) ?? { amount: 0, count: 0 }
      entry.children.set(tx.categoryId, { amount: roundMoney(child.amount + tx.amount), count: child.count + 1 })
    }
    current.set(root, entry)
  }

  const total = sum([...current.values()].map((entry) => entry.amount))
  return [...current.entries()]
    .map(([id, entry]) => {
      const display = categoryDisplay(id, categories)
      const previousAmount = previous.get(id) ?? 0
      const children = [...entry.children.entries()]
        .map(([childId, child]) => {
          const childDisplay = categoryDisplay(childId, categories)
          return {
            categoryId: childId,
            categoryName: childDisplay.name,
            parentCategory: display.name,
            color: childDisplay.color,
            icon: childDisplay.icon,
            amount: child.amount,
            percentage: total > 0 ? roundMoney((child.amount / total) * 100) : 0,
            transactionCount: child.count,
            averageTransaction: child.count > 0 ? roundMoney(child.amount / child.count) : 0,
            previousAmount: 0,
            changeAmount: child.amount,
            changePercentage: null,
            rank: 0,
            children: [],
          }
        })
        .sort((a, b) => b.amount - a.amount)

      return {
        categoryId: id,
        categoryName: display.name,
        parentCategory: display.parentCategory,
        color: display.color,
        icon: display.icon,
        amount: entry.amount,
        percentage: total > 0 ? roundMoney((entry.amount / total) * 100) : 0,
        transactionCount: entry.count,
        averageTransaction: entry.count > 0 ? roundMoney(entry.amount / entry.count) : 0,
        previousAmount,
        changeAmount: roundMoney(entry.amount - previousAmount),
        changePercentage: previousAmount > 0 ? roundMoney(((entry.amount - previousAmount) / previousAmount) * 100) : null,
        rank: 0,
        children,
      }
    })
    .sort((a, b) => b.amount - a.amount)
    .map((row, index) => ({ ...row, rank: index + 1 }))
}

function accountRows(
  accounts: ReportAccountInput[],
  allTxs: AppTransaction[],
  periodTxs: AppTransaction[],
  periodTo: string,
  includeArchivedAccounts: boolean,
): ReportAccountRow[] {
  return activeAccounts(accounts, includeArchivedAccounts).map((account) => {
    const txs = periodTxs.filter((tx) => tx.accountId === account.id || tx.destinationAccountId === account.id)
    let income = 0
    let expenses = 0
    let transfers = 0

    for (const tx of txs) {
      if (isCountableIncome(tx) && tx.accountId === account.id) income += tx.amount
      else if (isCountableExpense(tx) && tx.accountId === account.id) expenses += tx.amount
      else if (tx.transferReferenceKind !== 'none') transfers += tx.amount
    }

    const endingBalance = roundMoney(toNumber(account.balance) - accountFlowAfter(allTxs, account.id, periodTo))
    const change = roundMoney(income - expenses)
    return {
      accountId: account.id,
      accountName: account.name,
      type: account.type,
      currency: account.currency,
      color: account.color,
      isActive: account.is_active,
      isHidden: account.is_hidden,
      startingBalance: roundMoney(endingBalance - change),
      income: roundMoney(income),
      expenses: roundMoney(expenses),
      transfers: roundMoney(transfers),
      endingBalance,
      change,
      transactionCount: txs.length,
    }
  })
}

function accountFlowAfter(txs: AppTransaction[], accountId: string, afterDate: string): number {
  let total = 0
  for (const tx of txs) {
    if (tx.date <= afterDate) continue
    if (isCountableIncome(tx) && tx.accountId === accountId) total += tx.amount
    else if (isCountableExpense(tx) && tx.accountId === accountId) total -= tx.amount
    else if (tx.transferReferenceKind !== 'none') {
      if (tx.accountId === accountId) total -= tx.amount
      if (tx.destinationAccountId === accountId) total += tx.amount
    }
  }
  return roundMoney(total)
}

function fixedVariable(periodTxs: AppTransaction[], activeRecurringRulesCount: number, monthCount: number): ReportFixedVariable {
  const expenses = countableExpenses(periodTxs)
  const fixed = expenses.filter((tx) => Boolean(tx.recurringId))
  const variable = expenses.filter((tx) => !tx.recurringId)
  const fixedExpenses = sum(fixed.map((tx) => tx.amount))
  const variableExpenses = sum(variable.map((tx) => tx.amount))
  const total = roundMoney(fixedExpenses + variableExpenses)

  return {
    fixedExpenses,
    variableExpenses,
    unclassifiedExpenses: variableExpenses,
    fixedExpensePercentage: total > 0 ? roundMoney((fixedExpenses / total) * 100) : null,
    variableExpensePercentage: total > 0 ? roundMoney((variableExpenses / total) * 100) : null,
    recurringTransactionsCount: fixed.length,
    activeRecurringRulesCount,
    averageFixedMonthlyExpense: roundMoney(fixedExpenses / Math.max(1, monthCount)),
    classificationNote: 'Sono considerate fisse solo le uscite collegate a una ricorrenza esistente; le altre restano variabili/non classificate.',
  }
}

function highestExpenseDay(txs: AppTransaction[]): { date: string; amount: number } | null {
  const byDate = new Map<string, number>()
  for (const tx of countableExpenses(txs)) byDate.set(tx.date, roundMoney((byDate.get(tx.date) ?? 0) + tx.amount))
  const sorted = [...byDate.entries()].sort((a, b) => b[1] - a[1])
  return sorted[0] ? { date: sorted[0][0], amount: sorted[0][1] } : null
}

function streak(points: ReportMonthlyPoint[], positive: boolean): number {
  let count = 0
  for (let i = points.length - 1; i >= 0; i--) {
    if (positive ? points[i].cashFlow > 0 : points[i].cashFlow < 0) count += 1
    else break
  }
  return count
}

function buildRecords(periodTxs: AppTransaction[], monthlySeries: ReportMonthlyPoint[], expenseCategories: ReportCategoryRow[]): ReportRecords {
  const highestTransaction = [...periodTxs]
    .filter((tx) => isCountableIncome(tx) || isCountableExpense(tx))
    .sort((a, b) => b.amount - a.amount)[0]

  return {
    bestIncomeMonth: [...monthlySeries].sort((a, b) => b.income - a.income)[0] ?? null,
    highestExpenseMonth: [...monthlySeries].sort((a, b) => b.expenses - a.expenses)[0] ?? null,
    bestCashFlowMonth: [...monthlySeries].sort((a, b) => b.cashFlow - a.cashFlow)[0] ?? null,
    worstCashFlowMonth: [...monthlySeries].sort((a, b) => a.cashFlow - b.cashFlow)[0] ?? null,
    topExpenseCategory: expenseCategories[0] ?? null,
    biggestCategoryIncrease: [...expenseCategories].filter((row) => row.changeAmount > 0).sort((a, b) => b.changeAmount - a.changeAmount)[0] ?? null,
    biggestCategoryReduction: [...expenseCategories].filter((row) => row.changeAmount < 0).sort((a, b) => a.changeAmount - b.changeAmount)[0] ?? null,
    highestTransaction: highestTransaction ? {
      id: highestTransaction.id,
      date: highestTransaction.date,
      description: highestTransaction.description,
      amount: highestTransaction.amount,
      type: highestTransaction.type,
    } : null,
    highestExpenseDay: highestExpenseDay(periodTxs),
    positiveCashFlowStreak: streak(monthlySeries, true),
    negativeCashFlowStreak: streak(monthlySeries, false),
  }
}

function insight(type: ReportInsight['type'], severity: ReportInsightSeverity, title: string, message: string, metadata?: ReportInsight['metadata']): ReportInsight {
  return { type, severity, title, message, metadata }
}

function buildInsights(params: {
  summary: ReportSummary
  comparison: ReportComparison
  expenseCategories: ReportCategoryRow[]
  records: ReportRecords
}): ReportInsight[] {
  const insights: ReportInsight[] = []
  const { summary, comparison, expenseCategories, records } = params

  if (comparison.totalExpenses.percentageChange !== null && Math.abs(comparison.totalExpenses.percentageChange) >= 10) {
    insights.push(comparison.totalExpenses.absoluteChange! > 0
      ? insight('EXPENSES_INCREASED', 'WARNING', 'Spese in aumento', `Le uscite sono aumentate del ${comparison.totalExpenses.percentageChange.toFixed(1)}% rispetto al periodo precedente.`)
      : insight('EXPENSES_DECREASED', 'SUCCESS', 'Spese in calo', `Le uscite sono diminuite del ${Math.abs(comparison.totalExpenses.percentageChange).toFixed(1)}% rispetto al periodo precedente.`))
  }

  if (comparison.totalIncome.percentageChange !== null && Math.abs(comparison.totalIncome.percentageChange) >= 10) {
    insights.push(comparison.totalIncome.absoluteChange! > 0
      ? insight('INCOME_INCREASED', 'SUCCESS', 'Entrate in aumento', `Le entrate sono aumentate del ${comparison.totalIncome.percentageChange.toFixed(1)}% rispetto al periodo precedente.`)
      : insight('INCOME_DECREASED', 'WARNING', 'Entrate in calo', `Le entrate sono diminuite del ${Math.abs(comparison.totalIncome.percentageChange).toFixed(1)}% rispetto al periodo precedente.`))
  }

  if (summary.savingsRate !== null && summary.savingsRate < 0) {
    insights.push(insight('SAVINGS_RATE_NEGATIVE', 'DANGER', 'Risparmio negativo', 'Nel periodo selezionato le uscite superano le entrate.'))
  } else if (comparison.savingsRate.absoluteChange !== null && comparison.savingsRate.absoluteChange >= 5) {
    insights.push(insight('SAVINGS_RATE_IMPROVED', 'SUCCESS', 'Tasso di risparmio migliorato', `Il tasso di risparmio è cresciuto di ${comparison.savingsRate.absoluteChange.toFixed(1)} punti.`))
  }

  const spike = expenseCategories.find((row) => row.changeAmount >= 100 && (row.changePercentage ?? 0) >= 25)
  if (spike) {
    insights.push(insight('CATEGORY_SPIKE', 'WARNING', 'Categoria in crescita', `${spike.categoryName} è aumentata di ${spike.changeAmount.toFixed(2)} € rispetto al periodo precedente.`, { categoryId: spike.categoryId }))
  }

  if (summary.netWorthChange > 0) {
    insights.push(insight('NET_WORTH_INCREASED', 'SUCCESS', 'Patrimonio in crescita', `Il patrimonio netto è cresciuto di ${summary.netWorthChange.toFixed(2)} € nel periodo.`))
  } else if (summary.netWorthChange < 0) {
    insights.push(insight('NET_WORTH_DECREASED', 'WARNING', 'Patrimonio in calo', `Il patrimonio netto è diminuito di ${Math.abs(summary.netWorthChange).toFixed(2)} € nel periodo.`))
  }

  if (records.positiveCashFlowStreak >= 3) {
    insights.push(insight('POSITIVE_STREAK', 'SUCCESS', 'Serie positiva', `Da ${records.positiveCashFlowStreak} mesi consecutivi il cash flow è positivo.`))
  } else if (records.negativeCashFlowStreak >= 3) {
    insights.push(insight('NEGATIVE_STREAK', 'DANGER', 'Serie negativa', `Da ${records.negativeCashFlowStreak} mesi consecutivi il cash flow è negativo.`))
  }

  if (insights.length === 0) {
    insights.push(insight('INSUFFICIENT_DATA', 'INFO', 'Dati limitati', 'Non ci sono ancora abbastanza variazioni rilevanti per generare insight affidabili.'))
  }

  const seen = new Set<string>()
  return insights.filter((item) => {
    if (seen.has(item.type)) return false
    seen.add(item.type)
    return true
  }).slice(0, 5)
}

export function computeAdvancedReport(params: {
  accounts: ReportAccountInput[]
  categories: ReportCategoryInput[]
  transactions: ReportTransactionInput[]
  activeRecurringRulesCount: number
  period: ReportPeriod
  previousPeriod: ReportPeriod
  accountFilter: string | null
  categoryFilter: string | null
  typeFilter: 'all' | 'income' | 'expense' | 'both'
  includeTransfers: boolean
  includeArchivedAccounts: boolean
}) {
  const accounts = params.accounts
  const categories = params.categories
  const rawTxs = params.transactions.map((tx) => ({ ...tx, user_id: 'report-user', notes: null, receipt_url: null, receipt_data: null, created_at: '', updated_at: '' })) as Transaction[]
  const adapterAccounts = accounts.map((account) => ({
    ...account,
    user_id: 'report-user',
    icon: null,
    sort_order: 0,
    created_at: '',
    updated_at: '',
  })) as Account[]
  const adapted = adaptTransactionRows(rawTxs, { accounts: adapterAccounts, peerTransactions: rawTxs })
  const scoped = adapted.filter((tx) => {
    if (params.accountFilter && tx.accountId !== params.accountFilter && tx.destinationAccountId !== params.accountFilter) return false
    if (params.categoryFilter && rootCategoryId(tx.categoryId, categories) !== params.categoryFilter && tx.categoryId !== params.categoryFilter) return false
    return true
  })
  const filtered = scoped.filter((tx) => {
    if (params.typeFilter === 'income' && !isCountableIncome(tx)) return false
    if (params.typeFilter === 'expense' && !isCountableExpense(tx)) return false
    if (params.typeFilter === 'both' && !isCountableIncome(tx) && !isCountableExpense(tx)) return false
    if (!params.includeTransfers && tx.transferReferenceKind !== 'none') return false
    return true
  })
  const periodTxs = filtered.filter((tx) => isInPeriod(tx, params.period))
  const scopedPeriodTxs = scoped.filter((tx) => isInPeriod(tx, params.period))
  const previousTxs = filtered.filter((tx) => isInPeriod(tx, params.previousPeriod))
  const currentNetWorth = netWorth(accounts, params.includeArchivedAccounts)
  const netWorthEnd = roundMoney(currentNetWorth - flowAfter(adapted, params.period.to))
  const netWorthStart = roundMoney(netWorthEnd - cashFlow(periodTxs))
  const monthCount = periodMonthCount(params.period)
  const totalIncome = sum(countableIncome(periodTxs).map((tx) => tx.amount))
  const totalExpenses = sum(countableExpenses(periodTxs).map((tx) => tx.amount))
  const summary: ReportSummary = {
    totalIncome,
    totalExpenses,
    netCashFlow: roundMoney(totalIncome - totalExpenses),
    savingsRate: calculateSavingsRate(totalIncome, totalExpenses),
    averageMonthlyIncome: roundMoney(totalIncome / monthCount),
    averageMonthlyExpenses: roundMoney(totalExpenses / monthCount),
    averageMonthlyCashFlow: roundMoney((totalIncome - totalExpenses) / monthCount),
    highestExpense: Math.max(0, ...countableExpenses(periodTxs).map((tx) => tx.amount)),
    highestIncome: Math.max(0, ...countableIncome(periodTxs).map((tx) => tx.amount)),
    transactionCount: periodTxs.length,
    activeAccountsCount: accounts.filter((account) => account.is_active).length,
    netWorthStart,
    netWorthEnd,
    netWorthChange: roundMoney(netWorthEnd - netWorthStart),
    netWorthChangePercentage: netWorthStart !== 0 ? roundMoney(((netWorthEnd - netWorthStart) / Math.abs(netWorthStart)) * 100) : null,
    internalTransfersAmount: calculateTransferTotal(scopedPeriodTxs),
  }
  const previousIncome = sum(countableIncome(previousTxs).map((tx) => tx.amount))
  const previousExpenses = sum(countableExpenses(previousTxs).map((tx) => tx.amount))
  const previousSavingsRate = calculateSavingsRate(previousIncome, previousExpenses)
  const comparison: ReportComparison = {
    totalIncome: compareMetric(summary.totalIncome, previousIncome, 'up'),
    totalExpenses: compareMetric(summary.totalExpenses, previousExpenses, 'down'),
    netCashFlow: compareMetric(summary.netCashFlow, roundMoney(previousIncome - previousExpenses), 'up'),
    savingsRate: compareMetric(summary.savingsRate, previousSavingsRate, 'up'),
    netWorthEnd: compareMetric(summary.netWorthEnd, roundMoney(currentNetWorth - flowAfter(adapted, params.previousPeriod.to)), 'up'),
  }
  const monthlySeries = buildMonthlySeries(periodTxs, params.period, summary.netWorthEnd)
  const expenseCategories = categoryRows(periodTxs, previousTxs, categories, 'expense')
  const incomeCategories = categoryRows(periodTxs, previousTxs, categories, 'income')
  const accountsRows = accountRows(accounts, adapted, periodTxs, params.period.to, params.includeArchivedAccounts)
  const netWorthSeries = monthlySeries.map((point) => ({ key: point.key, month: point.month, netWorth: point.netWorth }))
  const netWorthValues = netWorthSeries.map((point) => point.netWorth).filter((value): value is number => value !== null)
  const netWorthReport: ReportNetWorth = {
    start: summary.netWorthStart,
    end: summary.netWorthEnd,
    change: summary.netWorthChange,
    changePercentage: summary.netWorthChangePercentage,
    highestNetWorth: Math.max(summary.netWorthEnd, ...netWorthValues),
    lowestNetWorth: Math.min(summary.netWorthEnd, ...netWorthValues),
    monthlySeries: netWorthSeries,
  }
  const records = buildRecords(periodTxs, monthlySeries, expenseCategories)
  const fixedVariableReport = fixedVariable(periodTxs, params.activeRecurringRulesCount, monthCount)

  return {
    summary,
    comparison,
    monthlySeries,
    expenseCategories,
    incomeCategories,
    fixedVariable: fixedVariableReport,
    netWorth: netWorthReport,
    records,
    insights: buildInsights({ summary, comparison, expenseCategories, records }),
    accounts: accountsRows,
  }
}
