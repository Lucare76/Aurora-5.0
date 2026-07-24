import type { SupabaseClient } from '@supabase/supabase-js'
import { ACCOUNT_TYPE_LABELS, FREQUENCY_LABELS, LOAN_TYPE_LABELS, TRANSACTION_TYPE_LABELS } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import type { AccountType, LoanType, RecurringFrequency, TransactionType } from '@/types/database'
import type { SearchGroup, SearchPayload, SearchResult, SearchResultType } from './types'

const MIN_QUERY_LENGTH = 2
const MAX_QUERY_LENGTH = 100
const LIMIT_PER_GROUP = 5
const MAX_TOTAL_RESULTS = 30

const GROUP_LABELS: Record<SearchResultType, string> = {
  TRANSACTION: 'Transazioni',
  ACCOUNT: 'Conti',
  CATEGORY: 'Categorie',
  BUDGET: 'Budget',
  GOAL: 'Obiettivi',
  LOAN: 'Prestiti',
  RECURRENCE: 'Ricorrenze',
}

export function normalizeSearchQuery(input: string): string {
  return input.trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY_LENGTH)
}

function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/[.,€]/g, '')
}

function ilikePattern(query: string): string {
  return `%${query.replace(/[%_]/g, '\\$&')}%`
}

export function scoreSearchResult(query: string, result: Pick<SearchResult, 'title' | 'subtitle' | 'metadata'>): number {
  const q = normalizeForMatch(query)
  const title = normalizeForMatch(result.title)
  const subtitle = normalizeForMatch(result.subtitle)
  const metadata = normalizeForMatch(result.metadata.join(' '))

  if (title === q) return 100
  if (title.startsWith(q)) return 80
  if (title.includes(q)) return 60
  if (subtitle.includes(q)) return 40
  if (metadata.includes(q)) return 20
  return 0
}

function sortAndLimit(type: SearchResultType, query: string, results: SearchResult[]): SearchGroup | null {
  const ranked = results
    .map((result) => ({ ...result, score: Math.max(result.score, scoreSearchResult(query, result)) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'it'))
    .slice(0, LIMIT_PER_GROUP)

  if (ranked.length === 0) return null
  return { type, label: GROUP_LABELS[type], results: ranked }
}

export function groupSearchResults(query: string, results: SearchResult[]): SearchPayload {
  const order: SearchResultType[] = ['TRANSACTION', 'ACCOUNT', 'CATEGORY', 'BUDGET', 'GOAL', 'LOAN', 'RECURRENCE']
  const groups = order
    .map((type) => sortAndLimit(type, query, results.filter((result) => result.type === type)))
    .filter(Boolean) as SearchGroup[]

  const totalBeforeCap = groups.reduce((sum, group) => sum + group.results.length, 0)
  let remaining = MAX_TOTAL_RESULTS
  const capped = groups
    .map((group) => {
      const resultsForGroup = group.results.slice(0, remaining)
      remaining -= resultsForGroup.length
      return { ...group, results: resultsForGroup }
    })
    .filter((group) => group.results.length > 0)

  return {
    query,
    groups: capped,
    totalResults: capped.reduce((sum, group) => sum + group.results.length, 0),
    truncated: totalBeforeCap > MAX_TOTAL_RESULTS,
  }
}

type SearchRow = Record<string, any>

function subtitle(parts: Array<string | null | undefined | false>): string {
  return parts.filter(Boolean).join(' · ')
}

export async function searchAurora(supabase: SupabaseClient, rawQuery: string, userId: string): Promise<SearchPayload> {
  const query = normalizeSearchQuery(rawQuery)
  if (query.length < MIN_QUERY_LENGTH) return { query, groups: [], totalResults: 0, truncated: false }

  const pattern = ilikePattern(query)
  const numericQuery = Number(query.replace(',', '.'))
  const amountFilter = Number.isFinite(numericQuery) ? `,amount.eq.${numericQuery}` : ''

  const [
    txRes,
    accountRes,
    categoryRes,
    budgetRes,
    goalRes,
    loanRes,
    recurringRes,
  ] = await Promise.all([
    supabase
      .from('transactions')
      .select('id,description,notes,amount,type,date,account_id,category_id')
      .eq('user_id', userId)
      .or(`description.ilike.${pattern},notes.ilike.${pattern}${amountFilter}`)
      .order('date', { ascending: false })
      .limit(LIMIT_PER_GROUP),
    supabase
      .from('accounts')
      .select('id,name,type,balance,currency,is_active')
      .eq('user_id', userId)
      .or(`name.ilike.${pattern},type.ilike.${pattern}`)
      .limit(LIMIT_PER_GROUP),
    supabase
      .from('categories')
      .select('id,name,type,parent_id,icon')
      .eq('user_id', userId)
      .or(`name.ilike.${pattern},type.ilike.${pattern}`)
      .limit(LIMIT_PER_GROUP),
    supabase
      .from('budgets')
      .select('id,category_id,amount,month,year')
      .eq('user_id', userId)
      .or(`year.eq.${Number.isFinite(numericQuery) ? numericQuery : -1},month.eq.${Number.isFinite(numericQuery) ? numericQuery : -1}`)
      .limit(LIMIT_PER_GROUP),
    supabase
      .from('savings_goals')
      .select('id,name,notes,target_amount,current_amount,status,archived,target_date')
      .eq('user_id', userId)
      .or(`name.ilike.${pattern},notes.ilike.${pattern},status.ilike.${pattern}`)
      .limit(LIMIT_PER_GROUP),
    supabase
      .from('loans')
      .select('id,counterpart,description,amount,remaining,type,is_settled,due_date')
      .eq('user_id', userId)
      .or(`counterpart.ilike.${pattern},description.ilike.${pattern}`)
      .limit(LIMIT_PER_GROUP),
    supabase
      .from('recurring_rules')
      .select('id,description,amount,type,frequency,next_due_date,is_active')
      .eq('user_id', userId)
      .or(`description.ilike.${pattern},frequency.ilike.${pattern}`)
      .limit(LIMIT_PER_GROUP),
  ])

  const errors = [txRes, accountRes, categoryRes, budgetRes, goalRes, loanRes, recurringRes]
    .map((res) => res.error)
    .filter(Boolean)
  if (errors.length > 0) throw errors[0]

  const categories = ((categoryRes.data ?? []) as SearchRow[])
  const categoryById = new Map(categories.map((category) => [category.id, category]))

  const budgetCategoryIds = [...new Set(((budgetRes.data ?? []) as SearchRow[]).map((budget) => budget.category_id).filter(Boolean))]
  const extraCategories = budgetCategoryIds.length
    ? await supabase.from('categories').select('id,name,icon,type').eq('user_id', userId).in('id', budgetCategoryIds)
    : { data: [], error: null }
  if (extraCategories.error) throw extraCategories.error
  for (const category of (extraCategories.data ?? []) as SearchRow[]) categoryById.set(category.id, category)

  const results: SearchResult[] = []

  for (const tx of (txRes.data ?? []) as SearchRow[]) {
    const cat = tx.category_id ? categoryById.get(tx.category_id) : null
    results.push({
      id: tx.id,
      type: 'TRANSACTION',
      title: tx.description || TRANSACTION_TYPE_LABELS[tx.type as TransactionType] || 'Movimento',
      subtitle: subtitle([formatCurrency(Number(tx.amount)), cat?.name, tx.date]),
      metadata: [tx.notes, tx.type, String(tx.amount), cat?.name].filter(Boolean),
      href: '/transactions',
      score: 0,
    })
  }

  for (const account of (accountRes.data ?? []) as SearchRow[]) {
    results.push({
      id: account.id,
      type: 'ACCOUNT',
      title: account.name,
      subtitle: subtitle([`Saldo ${formatCurrency(Number(account.balance), account.currency)}`, ACCOUNT_TYPE_LABELS[account.type as AccountType], account.is_active ? 'Attivo' : 'Inattivo']),
      metadata: [account.type, account.currency],
      href: '/accounts',
      score: 0,
    })
  }

  for (const category of categories) {
    const parent = category.parent_id ? categoryById.get(category.parent_id) : null
    results.push({
      id: category.id,
      type: 'CATEGORY',
      title: `${category.icon ? `${category.icon} ` : ''}${category.name}`,
      subtitle: subtitle([parent?.name, category.type === 'income' ? 'Entrata' : category.type === 'expense' ? 'Uscita' : 'Entrata/Uscita']),
      metadata: [category.name, parent?.name, category.type],
      href: '/categories',
      score: 0,
    })
  }

  for (const budget of (budgetRes.data ?? []) as SearchRow[]) {
    const cat = categoryById.get(budget.category_id)
    results.push({
      id: budget.id,
      type: 'BUDGET',
      title: cat?.name ?? 'Budget',
      subtitle: subtitle([`${String(budget.month).padStart(2, '0')}/${budget.year}`, formatCurrency(Number(budget.amount))]),
      metadata: [cat?.name, String(budget.month), String(budget.year), String(budget.amount)],
      href: `/budgets/${budget.id}`,
      score: 0,
    })
  }

  for (const goal of (goalRes.data ?? []) as SearchRow[]) {
    const percent = Number(goal.target_amount) > 0 ? Math.round((Number(goal.current_amount) / Number(goal.target_amount)) * 100) : 0
    results.push({
      id: goal.id,
      type: 'GOAL',
      title: goal.name,
      subtitle: subtitle([`${formatCurrency(Number(goal.current_amount))} di ${formatCurrency(Number(goal.target_amount))}`, `${percent}%`, goal.status]),
      metadata: [goal.notes, goal.status, String(goal.target_amount), goal.target_date],
      href: `/goals/${goal.id}`,
      score: 0,
    })
  }

  for (const loan of (loanRes.data ?? []) as SearchRow[]) {
    results.push({
      id: loan.id,
      type: 'LOAN',
      title: loan.counterpart,
      subtitle: subtitle([LOAN_TYPE_LABELS[loan.type as LoanType], `Residuo ${formatCurrency(Number(loan.remaining))}`, loan.is_settled ? 'Saldato' : 'Aperto']),
      metadata: [loan.description, loan.type, String(loan.amount), String(loan.remaining)],
      href: '/loans',
      score: 0,
    })
  }

  for (const rule of (recurringRes.data ?? []) as SearchRow[]) {
    results.push({
      id: rule.id,
      type: 'RECURRENCE',
      title: rule.description,
      subtitle: subtitle([formatCurrency(Number(rule.amount)), FREQUENCY_LABELS[rule.frequency as RecurringFrequency], rule.is_active ? 'Attiva' : 'In pausa']),
      metadata: [rule.type, rule.frequency, String(rule.amount), rule.next_due_date],
      href: '/recurring',
      score: 0,
    })
  }

  return groupSearchResults(query, results)
}

export { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH }
