import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildFinancialCalendarPeriod,
  computeCalendarForecast,
  generateActualTransactionEvents,
  generateBudgetEvents,
  generateGoalEvents,
  generateLoanEvents,
  generateRecurringEvents,
} from '@/lib/financial-calendar/calculations'
import { adaptTransactionRows } from '@/domain/accounting/transaction-adapter'
import { calculateExpenseTotal, calculateIncomeTotal, filterTransactionsByDateRange } from '@/domain/accounting/aggregations'
import type { Account, Budget, Category, Database, Loan, LoanPayment, RecurringRule, SavingsGoal, Transaction } from '@/types/database'
import type { HealthNotification, HealthPeriod, MonthlyCashFlowMetric, ProjectedLiquidityInput } from './types'
import { calculateFinancialHealth } from './engine'
import { buildMonthPeriod, dateKey, addMonths, previousComparablePeriod, roundMoney } from './helpers'

export class FinancialHealthInputError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_PERIOD'
      | 'INVALID_DATE_RANGE'
      | 'FINANCIAL_HEALTH_CALCULATION_FAILED'
      | 'SNAPSHOT_SAVE_FAILED'
      | 'SNAPSHOT_NOT_FOUND'
      | 'INVALID_CALCULATION_VERSION',
    message: string,
  ) {
    super(message)
    this.name = 'FinancialHealthInputError'
  }
}

type HealthSupabaseClient = SupabaseClient<Database>

function parsePeriod(searchParams: URLSearchParams, now = new Date()): HealthPeriod {
  const raw = searchParams.get('period') ?? dateKey(now).slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(raw)) throw new FinancialHealthInputError('INVALID_PERIOD', 'Periodo non valido.')
  const [year, month] = raw.split('-').map(Number)
  if (month < 1 || month > 12 || year < 2000 || year > 2100) throw new FinancialHealthInputError('INVALID_PERIOD', 'Periodo non valido.')
  return buildMonthPeriod(new Date(year, month - 1, 1))
}

function toCalendarAccount(account: Account) {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    balance: account.balance,
    currency: account.currency,
    is_active: account.is_active,
    is_hidden: account.is_hidden,
  }
}

function monthlyMetrics(transactions: Transaction[], accounts: Account[], from: string, to: string): MonthlyCashFlowMetric[] {
  const adapted = adaptTransactionRows(transactions, { accounts, peerTransactions: transactions })
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  const metrics: MonthlyCashFlowMetric[] = []
  for (let cursor = new Date(start.getFullYear(), start.getMonth(), 1); cursor <= end; cursor = addMonths(cursor, 1)) {
    const key = dateKey(cursor).slice(0, 7)
    const monthFrom = `${key}-01`
    const monthTo = dateKey(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0))
    const rows = filterTransactionsByDateRange(adapted, monthFrom, monthTo)
    const income = calculateIncomeTotal(rows)
    const expenses = calculateExpenseTotal(rows)
    const netCashFlow = roundMoney(income - expenses)
    metrics.push({
      key,
      income,
      expenses,
      netCashFlow,
      savingsRate: income > 0 ? roundMoney((netCashFlow / income) * 100) : null,
      transactionCount: rows.length,
      daysObserved: rows.length > 0 ? new Set(rows.map((row) => row.date)).size : 0,
    })
  }
  return metrics
}

function buildProjectedLiquidity(params: {
  accounts: Account[]
  categories: Category[]
  recurringRules: RecurringRule[]
  loans: Loan[]
  goals: SavingsGoal[]
  budgets: Budget[]
  transactions: Transaction[]
  today: string
  in90: string
}): ProjectedLiquidityInput {
  const period = buildFinancialCalendarPeriod(params.today, params.in90)
  const events = [
    ...generateRecurringEvents({ rules: params.recurringRules, accounts: params.accounts.map(toCalendarAccount), categories: params.categories, period, today: params.today }),
    ...generateLoanEvents({ loans: params.loans, period, today: params.today }),
    ...generateGoalEvents({ goals: params.goals, period, today: params.today }),
    ...generateBudgetEvents({ budgets: params.budgets, categories: params.categories, transactions: params.transactions, period, today: params.today }),
    ...generateActualTransactionEvents({ transactions: params.transactions.filter((tx) => tx.date >= params.today), accounts: params.accounts.map(toCalendarAccount), categories: params.categories }),
  ]
  const forecast = computeCalendarForecast({
    accounts: params.accounts.map(toCalendarAccount),
    events,
    period,
    threshold: 0,
    today: params.today,
    month: params.today.slice(0, 7),
  })
  const minUntil = (days: number) => Math.min(...forecast.dailySeries.slice(0, days + 1).map((point) => point.totalProjectedBalance))
  const negativeUntil = (days: number) => forecast.dailySeries.slice(0, days + 1).filter((point) => point.totalProjectedBalance < 0).length
  return {
    currentBalance: forecast.summary.openingBalance,
    minProjectedBalance7d: roundMoney(minUntil(7)),
    minProjectedBalance30d: roundMoney(minUntil(30)),
    minProjectedBalance90d: roundMoney(minUntil(90)),
    minProjectedBalanceDate: forecast.summary.minimumProjectedBalanceDate,
    negativeDays7d: negativeUntil(7),
    negativeDays30d: negativeUntil(30),
    negativeDays90d: negativeUntil(90),
    negativeAccounts30d: forecast.currentBalances.filter((account) => account.minimumProjectedBalance < 0).length,
    maxOverdraft: Math.min(0, forecast.summary.minimumProjectedBalance),
    projectedIncome30d: roundMoney(forecast.dailySeries.slice(0, 31).reduce((sum, point) => sum + point.projectedIncome, 0)),
    projectedExpenses30d: roundMoney(forecast.dailySeries.slice(0, 31).reduce((sum, point) => sum + point.projectedExpenses, 0)),
    dailySeries: forecast.dailySeries.map((point) => ({
      date: point.date,
      label: point.label,
      balance: roundMoney(point.totalProjectedBalance),
      income: roundMoney(point.projectedIncome),
      expenses: roundMoney(point.projectedExpenses),
    })),
  }
}

export async function buildFinancialHealthPayload(
  supabase: HealthSupabaseClient,
  searchParams: URLSearchParams,
  userId: string,
) {
  const now = new Date()
  const today = dateKey(now)
  const period = parsePeriod(searchParams, now)
  const previousPeriod = previousComparablePeriod(period)
  if (period.days > 366) throw new FinancialHealthInputError('INVALID_DATE_RANGE', 'Intervallo troppo ampio.')

  const twelveMonthsAgo = buildMonthPeriod(addMonths(new Date(`${period.from}T00:00:00`), -11)).from
  const in90Date = new Date(`${today}T00:00:00`)
  in90Date.setDate(in90Date.getDate() + 90)
  const in90 = dateKey(in90Date)
  const startYear = Number(twelveMonthsAgo.slice(0, 4))
  const endYear = Number(in90.slice(0, 4))

  const [
    profileRes,
    accountsRes,
    categoriesRes,
    transactionsRes,
    budgetsRes,
    recurringRes,
    goalsRes,
    contributionsRes,
    loansRes,
    loanPaymentsRes,
    notificationsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('timezone,display_name').eq('id', userId).maybeSingle(),
    supabase.from('accounts').select('id,user_id,name,type,balance,currency,is_active,is_hidden,color,icon,sort_order,created_at,updated_at').eq('user_id', userId),
    supabase.from('categories').select('id,user_id,name,type,color,icon,parent_id,is_default,sort_order,created_at').eq('user_id', userId),
    supabase.from('transactions').select('id,user_id,account_id,category_id,type,amount,description,notes,date,transfer_peer_id,recurring_id,receipt_url,receipt_data,created_at,updated_at').eq('user_id', userId).gte('date', twelveMonthsAgo).lte('date', in90).order('date', { ascending: true }).limit(10000),
    supabase.from('budgets').select('id,user_id,category_id,amount,month,year,created_at,updated_at').eq('user_id', userId).gte('year', startYear).lte('year', endYear),
    supabase.from('recurring_rules').select('id,user_id,account_id,category_id,type,amount,description,frequency,start_date,end_date,next_due_date,last_run_date,is_active,auto_create,created_at,updated_at').eq('user_id', userId),
    supabase.from('savings_goals').select('id,user_id,name,target_amount,current_amount,target_date,icon,color,notes,status,archived,created_at,updated_at').eq('user_id', userId),
    supabase.from('goal_contributions').select('id,goal_id,user_id,amount,date,note,created_at').eq('user_id', userId).gte('date', twelveMonthsAgo),
    supabase.from('loans').select('id,user_id,counterpart,type,amount,remaining,description,due_date,is_settled,settled_at,created_at,updated_at').eq('user_id', userId),
    supabase.from('loan_payments').select('id,loan_id,user_id,amount,paid_at,notes,created_at').eq('user_id', userId).gte('paid_at', `${twelveMonthsAgo}T00:00:00.000Z`),
    (supabase as unknown as SupabaseClient).from('notifications').select('id,type,severity,source_type,source_id,source_url,is_read,archived_at,resolved_at,snoozed_until,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(5000),
  ])

  const required = [profileRes, accountsRes, categoriesRes, transactionsRes, budgetsRes, recurringRes, goalsRes, contributionsRes, loansRes, loanPaymentsRes]
  if (required.some((res) => res.error)) throw new FinancialHealthInputError('FINANCIAL_HEALTH_CALCULATION_FAILED', 'Calcolo non disponibile.')

  const accounts = (accountsRes.data ?? []) as Account[]
  const categories = (categoriesRes.data ?? []) as Category[]
  const transactions = (transactionsRes.data ?? []) as Transaction[]
  const budgets = (budgetsRes.data ?? []) as Budget[]
  const recurringRules = (recurringRes.data ?? []) as RecurringRule[]
  const goals = (goalsRes.data ?? []) as SavingsGoal[]
  const loans = (loansRes.data ?? []) as Loan[]
  const projectedLiquidity = buildProjectedLiquidity({ accounts, categories, recurringRules, loans, goals, budgets, transactions, today, in90 })
  const history = monthlyMetrics(transactions, accounts, twelveMonthsAgo, period.to)

  const profile = profileRes.data as { timezone?: string; display_name?: string | null } | null
  const result = calculateFinancialHealth({
    now: now.toISOString(),
    timezone: profile?.timezone ?? 'Europe/Rome',
    accounts: accounts.map((account) => ({ id: account.id, name: account.name, type: account.type, balance: Number(account.balance), currency: account.currency, is_active: account.is_active, is_hidden: account.is_hidden })),
    categories: categories.map((category) => ({ id: category.id, name: category.name, type: category.type, parent_id: category.parent_id })),
    transactions: transactions.map((transaction) => ({ id: transaction.id, account_id: transaction.account_id, category_id: transaction.category_id, type: transaction.type, amount: Number(transaction.amount), description: transaction.description, date: transaction.date, transfer_peer_id: transaction.transfer_peer_id, recurring_id: transaction.recurring_id })),
    projectedLiquidity,
    recurringItems: recurringRules.map((rule) => ({ id: rule.id, account_id: rule.account_id, category_id: rule.category_id, type: rule.type, amount: Number(rule.amount), description: rule.description, frequency: rule.frequency, start_date: rule.start_date, end_date: rule.end_date, next_due_date: rule.next_due_date, is_active: rule.is_active, auto_create: rule.auto_create })),
    budgets: budgets.map((budget) => ({ id: budget.id, category_id: budget.category_id, amount: Number(budget.amount), month: budget.month, year: budget.year })),
    goals: goals.map((goal) => ({ id: goal.id, name: goal.name, target_amount: Number(goal.target_amount), current_amount: Number(goal.current_amount), target_date: goal.target_date, status: goal.status, archived: goal.archived, created_at: goal.created_at })),
    goalContributions: ((contributionsRes.data ?? []) as any[]).map((row) => ({ id: row.id, goal_id: row.goal_id, amount: Number(row.amount), date: row.date, created_at: row.created_at })),
    loans: loans.map((loan) => ({ id: loan.id, counterpart: loan.counterpart, type: loan.type, amount: Number(loan.amount), remaining: Number(loan.remaining), due_date: loan.due_date, is_settled: loan.is_settled })),
    loanPayments: ((loanPaymentsRes.data ?? []) as LoanPayment[]).map((payment) => ({ id: payment.id, loan_id: payment.loan_id, amount: Number(payment.amount), paid_at: payment.paid_at })),
    notifications: notificationsRes.error ? [] : ((notificationsRes.data ?? []) as HealthNotification[]),
    period,
    previousPeriod,
    historicalMonthlyMetrics: history,
  })

  return {
    ...result,
    profile: {
      displayName: profile?.display_name ?? null,
    },
  }
}
