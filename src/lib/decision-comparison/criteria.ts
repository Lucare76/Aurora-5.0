import { CRITERIA, PROFILE_WEIGHTS } from './constants'
import { validateWeights } from './validation'
import type { ComparisonProfile, CriterionDefinition, CriterionKey, CriterionWeights } from './types'

export function getCriteria(): CriterionDefinition[] {
  return [...CRITERIA]
}

// The comparison profile only changes the weights applied to each criterion —
// it never alters any underlying financial figure produced by the specialist
// affordability engines.
export function resolveWeights(
  profile: ComparisonProfile,
  customWeights?: Partial<Record<CriterionKey, number>> | null,
): CriterionWeights {
  if (profile === 'CUSTOM') {
    return validateWeights(customWeights ?? {})
  }
  // Defensive copy: PROFILE_WEIGHTS entries are shared module-level constants —
  // callers must not be able to mutate them via the returned weightsUsed object.
  return { ...PROFILE_WEIGHTS[profile] }
}
