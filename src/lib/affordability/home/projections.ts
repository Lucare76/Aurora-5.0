import type { AffordabilityBaseline, AffordabilityInput } from '../types'
import { buildProjection, type CostBreakdown } from '../metrics'

export function buildHomeProjection(
  baseline: AffordabilityBaseline,
  input: AffordabilityInput,
  costs: CostBreakdown,
  startDate: string,
) {
  return buildProjection(baseline, input, costs, startDate)
}
