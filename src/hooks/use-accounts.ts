'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Account } from '@/types/database'

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('name', { ascending: true })

    if (!error && data) setAccounts(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const totalBalance = accounts
    .filter((a) => a.is_active)
    .reduce((sum, a) => sum + a.balance, 0)

  return { accounts, loading, totalBalance, refetch: fetchAccounts }
}
