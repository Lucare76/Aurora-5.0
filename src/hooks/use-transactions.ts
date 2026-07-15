'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  const supabase = useMemo(() => createClient(), [])

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
      const startDate = new Date(options.year, options.month - 1, 1).toLocaleDateString('en-CA')
      const endDate = new Date(options.year, options.month, 0).toLocaleDateString('en-CA')
      query = query.gte('date', startDate).lte('date', endDate)
    }

    if (options.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query
    if (!error && data) setTransactions(data)
    setLoading(false)
  }, [supabase, options.limit, options.month, options.year, options.accountId])

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
