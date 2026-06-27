import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Account } from '@/types/database'

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: true })

    if (!error && data) setAccounts(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const totalBalance = accounts
    .filter((a) => a.is_active)
    .reduce((sum, a) => sum + a.balance, 0)

  return { accounts, loading, totalBalance, refetch: fetchAccounts }
}
