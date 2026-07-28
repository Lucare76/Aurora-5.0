import { buildProjection, type CostBreakdown } from '../metrics'
import type { AffordabilityBaseline, AffordabilityInput } from '../types'

export function buildTravelProjection(
  baseline: AffordabilityBaseline,
  input: AffordabilityInput,
  costs: CostBreakdown,
  startDate: string,
) {
  return buildProjection(baseline, input, costs, startDate)
}
