'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/types/database'

export interface CategoryTreeNode {
  category: Category
  children: Category[]
}

export function buildCategoryTree(categories: Category[], type?: 'income' | 'expense' | 'both'): CategoryTreeNode[] {
  const matchesType = (category: Category) => {
    if (!type) return true
    return category.type === type || category.type === 'both'
  }

  return categories
    .filter((category) => !category.parent_id && matchesType(category))
    .map((category) => ({
      category,
      children: categories.filter((child) => child.parent_id === category.id && matchesType(child)),
    }))
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })

    if (!error && data) setCategories(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const incomeCategories = categories.filter((c) => c.type === 'income' || c.type === 'both')
  const expenseCategories = categories.filter((c) => c.type === 'expense' || c.type === 'both')
  const getCategoryTree = useCallback(
    (type?: 'income' | 'expense' | 'both') => buildCategoryTree(categories, type),
    [categories],
  )

  return { categories, incomeCategories, expenseCategories, loading, refetch: fetchCategories, getCategoryTree }
}
