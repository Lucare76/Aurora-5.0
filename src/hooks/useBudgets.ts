import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Budget } from '@/types/database'

export function useBudgets(month?: number, year?: number) {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const currentMonth = month ?? now.getMonth() + 1
  const currentYear = year ?? now.getFullYear()

  const fetchBudgets = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('month', currentMonth)
      .eq('year', currentYear)

    if (!error && data) setBudgets(data)
    setLoading(false)
  }, [currentMonth, currentYear])

  useEffect(() => {
    fetchBudgets()
  }, [fetchBudgets])

  return { budgets, loading, refetch: fetchBudgets }
}
