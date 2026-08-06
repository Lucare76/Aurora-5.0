'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { filterPersonalAccounts } from '@/lib/dependent-finance/calculations'
import type { Account } from '@/types/database'

type AccountPurposeLink = { account_id: string; purpose: string | null }

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setAccounts([])
      setLoading(false)
      return
    }

    const [accountsRes, purposeLinksRes] = await Promise.all([
      supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true }),
      supabase
        .from('account_purpose_links')
        .select('account_id,purpose')
        .eq('user_id', user.id),
    ])

    if (!accountsRes.error && accountsRes.data) {
      const purposeLinks = purposeLinksRes.error ? [] : (purposeLinksRes.data ?? []) as AccountPurposeLink[]
      setAccounts(filterPersonalAccounts(accountsRes.data, purposeLinks))
    }
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
