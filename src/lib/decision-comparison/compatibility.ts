import { CRITERION_KEYS } from './constants'
import type { CompatibilityResult, NormalizedScenario } from './types'

// Compatibility rules:
//   - same domain type on every scenario  -> FULL comparison
//   - mixed domain types                  -> FINANCIAL_ONLY comparison
// Both levels compare on the same criteria set: NormalizedScenario only ever
// exposes the common, cross-domain metrics (never domain-specific ones), so a
// cross-type comparison is always safe once the scenarios themselves have been
// validated (see validation.ts) — the level only changes how results are framed
// in explanations.ts.
export function determineCompatibility(scenarios: NormalizedScenario[]): CompatibilityResult {
  const currency = scenarios[0].currency
  const sameType = scenarios.every((s) => s.type === scenarios[0].type)

  return {
    level: sameType ? 'FULL' : 'FINANCIAL_ONLY',
    sameType,
    currency,
    usableCriteria: [...CRITERION_KEYS],
  }
}
