'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Transaction } from '@/types/database'
import { adaptTransactionRows } from '@/domain/accounting/transaction-adapter'
import { calculateExpenseTotal, calculateIncomeTotal } from '@/domain/accounting/aggregations'

interface UseTransactionsOptions {
  limit?: number
  month?: number
  year?: number
  accountId?: string
}

const TRANSACTION_SELECT = 'id,user_id,account_id,category_id,type,amount,description,notes,date,transfer_peer_id,recurring_id,receipt_url,receipt_data,created_at,updated_at'

export function useTransactions(options: UseTransactionsOptions = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('transactions')
      .select(TRANSACTION_SELECT)
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

  const adaptedTransactions = useMemo(
    () => adaptTransactionRows(transactions),
    [transactions],
  )
  const totalIncome = useMemo(
    () => calculateIncomeTotal(adaptedTransactions),
    [adaptedTransactions],
  )
  const totalExpense = useMemo(
    () => calculateExpenseTotal(adaptedTransactions),
    [adaptedTransactions],
  )

  return {
    transactions,
    adaptedTransactions,
    loading,
    totalIncome,
    totalExpense,
    refetch: fetchTransactions,
  }
}
