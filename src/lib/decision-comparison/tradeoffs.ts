import type { CriterionKey, DominanceRelation, ScenarioScore, TradeoffSummary } from './types'

// Tolerance (in normalized-score points, 0-100 scale) below which two scores
// are treated as equal — protects dominance/tradeoff detection from float noise.
const SCORE_EPSILON = 0.01

function pairKey(a: string, b: string): string {
  return `${a}::${b}`
}

// A dominates B when A is never worse than B on any criterion and strictly
// better on at least one — using the already direction-adjusted normalized
// scores, so "better" uniformly means "higher normalized score" here.
export function computeDominance(scores: ScenarioScore[]): DominanceRelation[] {
  const relations: DominanceRelation[] = []

  for (const a of scores) {
    for (const b of scores) {
      if (a.scenarioId === b.scenarioId) continue

      const marginCriteria: CriterionKey[] = []
      let neverWorse = true

      for (let i = 0; i < a.criterionScores.length; i++) {
        const diff = a.criterionScores[i].normalizedScore - b.criterionScores[i].normalizedScore
        if (diff < -SCORE_EPSILON) {
          neverWorse = false
          break
        }
        if (diff > SCORE_EPSILON) {
          marginCriteria.push(a.criterionScores[i].criterion)
        }
      }

      if (neverWorse && marginCriteria.length > 0) {
        relations.push({ dominantScenarioId: a.scenarioId, dominatedScenarioId: b.scenarioId, marginCriteria })
      }
    }
  }

  return relations
}

// For every pair not covered by dominance, describes which criteria favor
// which side — the compromise a decision-maker actually has to weigh.
export function computeTradeoffs(scores: ScenarioScore[], dominance: DominanceRelation[]): TradeoffSummary[] {
  const dominancePairs = new Set(dominance.map((d) => pairKey(d.dominantScenarioId, d.dominatedScenarioId)))
  const summaries: TradeoffSummary[] = []

  for (let i = 0; i < scores.length; i++) {
    for (let j = i + 1; j < scores.length; j++) {
      const a = scores[i]
      const b = scores[j]
      const isDominance = dominancePairs.has(pairKey(a.scenarioId, b.scenarioId)) || dominancePairs.has(pairKey(b.scenarioId, a.scenarioId))

      const aWinsOn: CriterionKey[] = []
      const bWinsOn: CriterionKey[] = []
      const tiedOn: CriterionKey[] = []

      for (let k = 0; k < a.criterionScores.length; k++) {
        const diff = a.criterionScores[k].normalizedScore - b.criterionScores[k].normalizedScore
        if (Math.abs(diff) <= SCORE_EPSILON) tiedOn.push(a.criterionScores[k].criterion)
        else if (diff > 0) aWinsOn.push(a.criterionScores[k].criterion)
        else bWinsOn.push(a.criterionScores[k].criterion)
      }

      summaries.push({ scenarioAId: a.scenarioId, scenarioBId: b.scenarioId, aWinsOn, bWinsOn, tiedOn, isDominance })
    }
  }

  return summaries
}
