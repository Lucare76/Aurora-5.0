import rules from './category-rules.json'

interface CategoryRule {
  keyword: string
  category: string
  subcategory: string | null
  confidence: number
  samples: number
}

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
