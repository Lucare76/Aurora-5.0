import type { HomeCosts } from './types'

export function buildOwnershipCostRows(costs: HomeCosts): Array<{ label: string; amount: number }> {
  return costs.costBreakdown.filter((row) => row.amount > 0)
}
