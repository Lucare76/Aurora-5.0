import { buildTransactionExportRows, buildTransactionsCsv } from '@/domain/accounting/export'
import { adaptTransactionRows, type AppTransaction } from '@/domain/accounting/transaction-adapter'
import { getPersonalExcludedAccountIds, loadAccountPurposeLinks } from '@/lib/dependent-finance/calculations'
import { createClient } from '@/lib/supabase/client'
import type { Account, Category, Transaction } from '@/types/database'

const TRANSACTION_SELECT = 'id,user_id,account_id,category_id,type,amount,description,notes,date,transfer_peer_id,recurring_id,receipt_url,receipt_data,is_neutral,created_at,updated_at'

type ExportFilters = {
  personalOnly?: boolean
  search?: string
  categoryIds?: string[]
  amountMin?: number
  amountMax?: number
}

export function filterTransactionsForExport(
  transactions: AppTransaction[],
  categories: Pick<Category, 'id' | 'parent_id'>[],
  options: ExportFilters,
) {
  let selected = transactions
  if (options.personalOnly) selected = selected.filter((transaction) => !(transaction.transferReferenceKind !== 'none' && transaction.type === 'income'))
  if (options.search?.trim()) {
    const search = options.search.trim().toLowerCase()
    selected = selected.filter((transaction) => transaction.description?.toLowerCase().includes(search) || transaction.notes?.toLowerCase().includes(search))
  }
  if (options.categoryIds?.length) {
    const categoriesById = new Map(categories.map((category) => [category.id, category]))
    selected = selected.filter((transaction) => {
      if (!transaction.categoryId) return options.categoryIds!.includes('none')
      const parentId = categoriesById.get(transaction.categoryId)?.parent_id
      return options.categoryIds!.includes(transaction.categoryId) || Boolean(parentId && options.categoryIds!.includes(parentId))
    })
  }
  if (options.amountMin !== undefined) selected = selected.filter((transaction) => transaction.amount >= options.amountMin!)
  if (options.amountMax !== undefined) selected = selected.filter((transaction) => transaction.amount <= options.amountMax!)
  return selected
}

export async function downloadTransactionsCsv(options: {
  userId: string
  from?: string
  to?: string
  accountId?: string
  personalOnly?: boolean
  type?: 'income' | 'expense' | 'transfer'
  search?: string
  categoryIds?: string[]
  amountMin?: number
  amountMax?: number
}) {
  const db = createClient()
  const [catRes, accRes, linkRes] = await Promise.all([
    db.from('categories').select('id,name,parent_id').eq('user_id', options.userId),
    db.from('accounts').select('id,name,user_id').eq('user_id', options.userId),
    options.personalOnly ? db.from('account_purpose_links').select('account_id,purpose').eq('user_id', options.userId) : Promise.resolve({ data: [], error: null }),
  ])
  if (catRes.error) throw catRes.error
  if (accRes.error) throw accRes.error
  const links = loadAccountPurposeLinks(linkRes) as { account_id: string; purpose: string | null }[]
  const accounts = (accRes.data ?? []) as Pick<Account, 'id' | 'name' | 'user_id'>[]
  const categories = (catRes.data ?? []) as Pick<Category, 'id' | 'name' | 'parent_id'>[]
  const excluded = options.personalOnly ? [...getPersonalExcludedAccountIds(links, accounts)] : []
  if (options.accountId && excluded.includes(options.accountId)) throw new Error('Il conto selezionato non appartiene ai movimenti personali.')

  const transactions: Transaction[] = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    let query = db.from('transactions').select(TRANSACTION_SELECT).eq('user_id', options.userId)
    if (options.from) query = query.gte('date', options.from)
    if (options.to) query = query.lte('date', options.to)
    if (options.accountId) query = query.eq('account_id', options.accountId)
    if (options.type) query = query.eq('type', options.type)
    if (excluded.length > 0) query = query.not('account_id', 'in', `(${excluded.join(',')})`)
    const { data, error } = await query
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + pageSize - 1)
    if (error) throw error
    transactions.push(...((data ?? []) as Transaction[]))
    if ((data?.length ?? 0) < pageSize) break
  }

  const knownIds = new Set(transactions.map((transaction) => transaction.id))
  const peerIds = [...new Set(transactions.map((transaction) => transaction.transfer_peer_id).filter((id): id is string => Boolean(id && !knownIds.has(id))))]
  const peers: Transaction[] = []
  for (let offset = 0; offset < peerIds.length; offset += 100) {
    const { data, error } = await db.from('transactions').select(TRANSACTION_SELECT).eq('user_id', options.userId).in('id', peerIds.slice(offset, offset + 100))
    if (error) throw error
    peers.push(...((data ?? []) as Transaction[]))
  }

  const selected = filterTransactionsForExport(adaptTransactionRows(transactions, {
    accounts: accounts as Account[],
    peerTransactions: [...transactions, ...peers],
  }), categories, options)
  const rows = buildTransactionExportRows(selected, categories, accounts)
  const csv = buildTransactionsCsv(rows)
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `aurora-transazioni-${options.from || 'inizio'}-${options.to || 'oggi'}.csv`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
  return rows.length
}
