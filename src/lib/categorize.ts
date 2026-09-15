import rules from './category-rules.json'
import { isCategoryCompatibleWithTransactionType } from '@/domain/accounting/category-compatibility'
import type { CategoryType, TransactionType } from '@/types/database'

interface CategoryRule {
  keyword: string
  category: string
  subcategory: string | null
  confidence: number
  samples: number
}

type SuggestableCategory = { id: string; name: string; type: CategoryType; parent_id: string | null }

export function suggestCategory(description: string): { category: string; subcategory: string | null } | null {
  const upper = description.toUpperCase()
  const sorted = [...(rules as CategoryRule[])].sort((a, b) => b.samples - a.samples)
  for (const rule of sorted) {
    if (upper.includes(rule.keyword)) {
      return { category: rule.category, subcategory: rule.subcategory }
    }
  }
  return null
}

/**
 * Like suggestCategory, but resolves the suggested category name to a real id
 * AND only returns it if it's actually compatible with the transaction's real
 * type. A keyword rule only ever sees the description text, never the
 * transaction type, so on its own it can propose a category that contradicts
 * transaction.type — this is exactly how a 'BONIFICO' match sent an 'expense'
 * transaction (a loan to a relative) into the 'income'-typed "Disoccupazione"
 * category. Returns null (leave uncategorized) rather than force a
 * semantically wrong category.
 */
export function suggestCompatibleCategoryId(
  description: string,
  transactionType: TransactionType,
  categories: SuggestableCategory[],
): string | null {
  const suggestion = suggestCategory(description)
  if (!suggestion) return null

  const parent = categories.find((c) => !c.parent_id && c.name === suggestion.category)
  if (!parent) return null
  const target = suggestion.subcategory
    ? categories.find((c) => c.parent_id === parent.id && c.name === suggestion.subcategory)
    : parent
  if (!target) return null

  return isCategoryCompatibleWithTransactionType(transactionType, target.type) ? target.id : null
}
