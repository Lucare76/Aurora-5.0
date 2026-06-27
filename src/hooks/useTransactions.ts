import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/types/database'

interface UseTransactionsOptions {
  limit?: number
  month?: number
  year?: number
  accountId?: string
}

export function useTransactions(options: UseTransactionsOptions = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })

    if (options.accountId) {
      query = query.eq('account_id', options.accountId)
    }

    if (options.month !== undefined && options.year !== undefined) {
      const startDate = new Date(options.year, options.month - 1, 1).toISOString().split('T')[0]
      const endDate = new Date(options.year, options.month, 0).toISOString().split('T')[0]
      query = query.gte('date', startDate).lte('date', endDate)
    }

    if (options.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query
    if (!error && data) setTransactions(data)
    setLoading(false)
  }, [options.limit, options.month, options.year, options.accountId])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  return { transactions, loading, totalIncome, totalExpense, refetch: fetchTransactions }
}
