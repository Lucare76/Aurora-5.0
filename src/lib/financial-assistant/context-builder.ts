import {
  buildAdiSummary,
  buildAuroraScopeSummary,
  filterAccountsByScope,
  filterTransactionsByScope,
} from '@/lib/dependent-finance/calculations'
import { MAX_CONTEXT_TRANSACTIONS } from './constants'
import { makeCitation } from './citations'
import { money } from './evidence'
import { resolvePeriod } from './periods'
import type {
  AssistantAccount,
  AssistantAdiEntry,
  AssistantBudget,
  AssistantCategory,
  AssistantContext,
  AssistantGoal,
  AssistantLoan,
  AssistantQuery,
  AssistantRecurring,
  AssistantRuntime,
  AssistantTransaction,
  FinancialAssistantScope,
} from './types'

type SupabaseLike = {
  from: (table: string) => any
}

type AccountScopeLink = { account_id: string; purpose: string | null }

function rows<T>(data: T[] | null, error?: { message?: string } | null): T[] {
  if (error) throw new Error(error.message ?? 'Errore durante la lettura dei dati.')
  return data ?? []
}

function applyPeriod(query: any, period: { from: string | null; to: string | null }) {
  let next = query
  if (period.from) next = next.gte('date', period.from)
  if (period.to) next = next.lte('date', period.to)
  return next
}

export async function buildAssistantContext(params: {
  supabase: SupabaseLike
  runtime: AssistantRuntime
  query: AssistantQuery
  scope: FinancialAssistantScope
}): Promise<AssistantContext> {
  const period = resolvePeriod(params.query.period ?? 'CURRENT_MONTH', params.runtime.now)
  const userId = params.runtime.user.id

  const [
    accountsRes,
    linksRes,
    categoriesRes,
    budgetsRes,
    goalsRes,
    recurringRes,
    loansRes,
    transactionsRes,
    adiRes,
  ] = await Promise.all([
    params.supabase
      .from('accounts')
      .select('id,name,type,balance,currency,is_active')
      .eq('user_id', userId)
      .order('name', { ascending: true }),
    params.supabase
      .from('account_purpose_links')
      .select('account_id,purpose')
      .eq('user_id', userId),
    params.supabase
      .from('categories')
      .select('id,name,type,parent_id,color,icon')
      .eq('user_id', userId)
      .order('name', { ascending: true }),
    params.supabase
      .from('budgets')
      .select('id,category_id,amount,month,year')
      .eq('user_id', userId),
    params.supabase
      .from('savings_goals')
      .select('id,name,target_amount,current_amount,status,target_date')
      .eq('user_id', userId)
      .order('target_date', { ascending: true }),
    params.supabase
      .from('recurring_rules')
      .select('id,description,amount,type,frequency,next_due_date,is_active')
      .eq('user_id', userId)
      .limit(100),
    params.supabase
      .from('loans')
      .select('id,counterpart,amount,remaining,type,is_settled')
      .eq('user_id', userId)
      .limit(100),
    applyPeriod(
      params.supabase
        .from('transactions')
        .select('id,account_id,transfer_peer_id,category_id,amount,type,description,date')
        .eq('user_id', userId),
      period,
    )
      .order('date', { ascending: false })
      .limit(MAX_CONTEXT_TRANSACTIONS),
    params.scope === 'ADI'
      ? params.supabase
          .from('adi_entries')
          .select('id,entry_type,adi_category,amount,date,reference_period')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [], error: null }),
  ])

  const links = rows<AccountScopeLink>(linksRes.data, linksRes.error)
  const allAccounts = rows<AssistantAccount>(accountsRes.data, accountsRes.error).map((account) => ({
    ...account,
    type: account.type ?? undefined,
    balance: money(account.balance),
    is_active: account.is_active !== false,
  }))
  const allTransactions = rows<AssistantTransaction>(transactionsRes.data, transactionsRes.error).map((transaction) => ({
    ...transaction,
    account_id: transaction.account_id ?? undefined,
    amount: money(transaction.amount),
    type: transaction.type,
  }))

  const dependentScope = params.scope === 'AURORA' ? 'DEPENDENT_AURORA' : params.scope
  const accounts = filterAccountsByScope(allAccounts, links, dependentScope)
  const transactions = filterTransactionsByScope(allTransactions, links, dependentScope, allAccounts)
  const adiEntries = rows<AssistantAdiEntry>(adiRes.data, adiRes.error).map((entry) => ({
    ...entry,
    amount: money(entry.amount),
  }))

  const citations = [
    makeCitation({
      label: 'Conti letti da Supabase',
      table: 'accounts',
      fields: ['id', 'name', 'type', 'balance', 'currency', 'is_active'],
      rowCount: accounts.length,
      filteredBy: ['user_id', `scope:${params.scope}`],
    }),
    makeCitation({
      label: 'Movimenti letti da Supabase',
      table: 'transactions',
      fields: ['id', 'account_id', 'category_id', 'amount', 'type', 'date'],
      rowCount: transactions.length,
      filteredBy: ['user_id', `scope:${params.scope}`, period.label],
    }),
  ]

  if (params.scope === 'AURORA') {
    const auroraSummary = buildAuroraScopeSummary({ accounts, transactions, links, from: period.from ?? undefined, to: period.to ?? undefined })
    citations.push(makeCitation({
      label: `Statistiche Aurora aggregate (${auroraSummary.activeAccountsCount} conti)`,
      table: 'account_purpose_links',
      fields: ['account_id', 'purpose'],
      rowCount: links.filter((link) => link.purpose === 'DEPENDENT_AURORA' || link.purpose === 'DEPENDENT').length,
      filteredBy: ['purpose:DEPENDENT_AURORA'],
    }))
  }

  if (params.scope === 'ADI') {
    buildAdiSummary(adiEntries)
    citations.push(makeCitation({
      label: 'Voci ADI lette da Supabase',
      table: 'adi_entries',
      fields: ['entry_type', 'adi_category', 'amount', 'date', 'reference_period'],
      rowCount: adiEntries.length,
      filteredBy: ['user_id', 'scope:ADI'],
    }))
  }

  return {
    runtime: params.runtime,
    scope: params.scope,
    period,
    accounts,
    transactions,
    categories: rows<AssistantCategory>(categoriesRes.data, categoriesRes.error),
    budgets: rows<AssistantBudget>(budgetsRes.data, budgetsRes.error).map((budget) => ({ ...budget, amount: money(budget.amount) })),
    goals: rows<AssistantGoal>(goalsRes.data, goalsRes.error).map((goal) => ({
      ...goal,
      target_amount: money(goal.target_amount),
      current_amount: money(goal.current_amount),
    })),
    recurring: rows<AssistantRecurring & { next_due_date?: string | null }>(recurringRes.data, recurringRes.error).map((item) => ({
      ...item,
      amount: money(item.amount),
      next_date: item.next_date ?? item.next_due_date ?? null,
    })),
    loans: rows<AssistantLoan & { counterpart?: string | null }>(loansRes.data, loansRes.error).map((loan) => ({
      ...loan,
      person_name: loan.person_name ?? loan.counterpart ?? 'Persona',
      amount: money(loan.amount),
      remaining: money(loan.remaining),
    })),
    adiEntries,
    citations,
  }
}
