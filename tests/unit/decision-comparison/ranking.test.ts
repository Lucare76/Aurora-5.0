import { describe, expect, it } from 'vitest'
import { determineCriterionWinners, rankScenarios } from '@/lib/decision-comparison/ranking'
import { CRITERIA } from '@/lib/decision-comparison/constants'
import type { CriterionDefinition, ScenarioScore } from '@/lib/decision-comparison/types'
import { makeScenario } from './fixtures'

function score(overrides: Partial<ScenarioScore> = {}): ScenarioScore {
  return {
    scenarioId: 'a',
    criterionScores: [],
    rawWeightedScore: 0,
    liquidityPenalty: 0,
    confidenceFactor: 1,
    finalScore: 0,
    ...overrides,
  }
}

describe('rankScenarios — ordering', () => {
  it('ranks the higher score first', () => {
    const scores = [score({ scenarioId: 'a', finalScore: 60 }), score({ scenarioId: 'b', finalScore: 90 })]
    const scenarios = [makeScenario({ id: 'a' }), makeScenario({ id: 'b' })]
    const ranking = rankScenarios(scores, scenarios)
    expect(ranking.find((r) => r.scenarioId === 'b')!.rank).toBe(1)
    expect(ranking.find((r) => r.scenarioId === 'a')!.rank).toBe(2)
  })

  it('handles the minimum of 2 scenarios', () => {
    const scores = [score({ scenarioId: 'a', finalScore: 50 }), score({ scenarioId: 'b', finalScore: 70 })]
    const scenarios = [makeScenario({ id: 'a' }), makeScenario({ id: 'b' })]
    expect(rankScenarios(scores, scenarios)).toHaveLength(2)
  })

  it('handles the maximum of 4 scenarios with distinct scores', () => {
    const ids = ['a', 'b', 'c', 'd']
    const scores = ids.map((id, i) => score({ scenarioId: id, finalScore: 40 + i * 10 }))
    const scenarios = ids.map((id) => makeScenario({ id }))
    const ranking = rankScenarios(scores, scenarios)
    expect(ranking.map((r) => r.rank).sort()).toEqual([1, 2, 3, 4])
    expect(ranking.find((r) => r.scenarioId === 'd')!.rank).toBe(1)
  })
})

describe('rankScenarios — parity / ties', () => {
  it('treats scores within SCORE_TIE_EPSILON as a tie sharing the same rank', () => {
    const scores = [score({ scenarioId: 'a', finalScore: 80 }), score({ scenarioId: 'b', finalScore: 80.3 })]
    const scenarios = [makeScenario({ id: 'a' }), makeScenario({ id: 'b' })]
    const ranking = rankScenarios(scores, scenarios)
    expect(ranking.find((r) => r.scenarioId === 'a')!.isTie).toBe(true)
    expect(ranking.find((r) => r.scenarioId === 'b')!.isTie).toBe(true)
    expect(ranking.find((r) => r.scenarioId === 'a')!.rank).toBe(ranking.find((r) => r.scenarioId === 'b')!.rank)
  })

  it('treats identical scores as a full tie and lists each other as tiedWith', () => {
    const scores = [score({ scenarioId: 'a', finalScore: 55 }), score({ scenarioId: 'b', finalScore: 55 })]
    const scenarios = [makeScenario({ id: 'a' }), makeScenario({ id: 'b' })]
    const ranking = rankScenarios(scores, scenarios)
    expect(ranking.find((r) => r.scenarioId === 'a')!.tiedWithScenarioIds).toEqual(['b'])
    expect(ranking.find((r) => r.scenarioId === 'b')!.tiedWithScenarioIds).toEqual(['a'])
  })

  it('does not treat scores differing by more than SCORE_TIE_EPSILON as tied', () => {
    const scores = [score({ scenarioId: 'a', finalScore: 80 }), score({ scenarioId: 'b', finalScore: 81 })]
    const scenarios = [makeScenario({ id: 'a' }), makeScenario({ id: 'b' })]
    const ranking = rankScenarios(scores, scenarios)
    expect(ranking.find((r) => r.scenarioId === 'a')!.isTie).toBe(false)
    expect(ranking.find((r) => r.scenarioId === 'b')!.isTie).toBe(false)
  })

  it('breaks a tied score by the more sustainable affordability classification (display order, same rank number)', () => {
    // Scores within SCORE_TIE_EPSILON always share one rank number (they are a
    // genuine tie); classification/id only make the sort order deterministic.
    const scores = [score({ scenarioId: 'a', finalScore: 70 }), score({ scenarioId: 'b', finalScore: 70 })]
    const scenarios = [
      makeScenario({ id: 'a', metrics: { affordabilityClassification: 'RISKY' } }),
      makeScenario({ id: 'b', metrics: { affordabilityClassification: 'AFFORDABLE' } }),
    ]
    const ranking = rankScenarios(scores, scenarios)
    expect(ranking.find((r) => r.scenarioId === 'a')!.rank).toBe(1)
    expect(ranking.find((r) => r.scenarioId === 'b')!.rank).toBe(1)
    expect(ranking.findIndex((r) => r.scenarioId === 'b')).toBeLessThan(
      ranking.findIndex((r) => r.scenarioId === 'a'),
    )
  })

  it('falls back to scenario id ordering when score and classification both tie', () => {
    const scores = [score({ scenarioId: 'zeta', finalScore: 70 }), score({ scenarioId: 'alpha', finalScore: 70 })]
    const scenarios = [makeScenario({ id: 'zeta' }), makeScenario({ id: 'alpha' })]
    const ranking = rankScenarios(scores, scenarios)
    expect(ranking.find((r) => r.scenarioId === 'alpha')!.rank).toBe(1)
  })
})

describe('determineCriterionWinners', () => {
  const lowerIsBetter: CriterionDefinition = CRITERIA.find((c) => c.key === 'totalCashOutflow')!

  it('picks the clear winner on a lowerIsBetter criterion', () => {
    const scenarios = [
      makeScenario({ id: 'a', metrics: { totalCashOutflow: 10000 } }),
      makeScenario({ id: 'b', metrics: { totalCashOutflow: 30000 } }),
    ]
    const [winner] = determineCriterionWinners(scenarios, [lowerIsBetter])
    expect(winner.winnerScenarioId).toBe('a')
    expect(winner.isTie).toBe(false)
    expect(winner.isNegligibleDifference).toBe(false)
  })

  it('flags an exact tie (no usable winner)', () => {
    const scenarios = [
      makeScenario({ id: 'a', metrics: { totalCashOutflow: 10000 } }),
      makeScenario({ id: 'b', metrics: { totalCashOutflow: 10000 } }),
    ]
    const [winner] = determineCriterionWinners(scenarios, [lowerIsBetter])
    expect(winner.winnerScenarioId).toBeNull()
    expect(winner.isTie).toBe(true)
  })

  it('flags a negligible difference below NEGLIGIBLE_DIFFERENCE_RATIO as a tie', () => {
    // range across 3 scenarios is 100000; a vs b gap is 500 -> 0.5% < 2% threshold
    const scenarios = [
      makeScenario({ id: 'a', metrics: { totalCashOutflow: 10000 } }),
      makeScenario({ id: 'b', metrics: { totalCashOutflow: 10500 } }),
      makeScenario({ id: 'c', metrics: { totalCashOutflow: 110000 } }),
    ]
    const [winner] = determineCriterionWinners(scenarios, [lowerIsBetter])
    expect(winner.isNegligibleDifference).toBe(true)
    expect(winner.isTie).toBe(true)
    expect(winner.winnerScenarioId).toBeNull()
  })

  it('does not flag a difference above the negligible ratio as a tie', () => {
    const scenarios = [
      makeScenario({ id: 'a', metrics: { totalCashOutflow: 10000 } }),
      makeScenario({ id: 'b', metrics: { totalCashOutflow: 50000 } }),
      makeScenario({ id: 'c', metrics: { totalCashOutflow: 110000 } }),
    ]
    const [winner] = determineCriterionWinners(scenarios, [lowerIsBetter])
    expect(winner.isNegligibleDifference).toBe(false)
    expect(winner.winnerScenarioId).toBe('a')
  })

  it('reports no winner when the criterion is missing for every scenario', () => {
    const scenarios = [
      makeScenario({ id: 'a', missingMetrics: ['totalCashOutflow'] }),
      makeScenario({ id: 'b', missingMetrics: ['totalCashOutflow'] }),
    ]
    const [winner] = determineCriterionWinners(scenarios, [lowerIsBetter])
    expect(winner.winnerScenarioId).toBeNull()
    expect(winner.isTie).toBe(false)
    expect(winner.isNegligibleDifference).toBe(false)
  })

  it('declares a winner when only one scenario has usable data', () => {
    const scenarios = [
      makeScenario({ id: 'a', metrics: { totalCashOutflow: 10000 } }),
      makeScenario({ id: 'b', missingMetrics: ['totalCashOutflow'] }),
    ]
    const [winner] = determineCriterionWinners(scenarios, [lowerIsBetter])
    expect(winner.winnerScenarioId).toBe('a')
    expect(winner.isTie).toBe(false)
  })

  it('computes a winner for every criterion in the catalogue', () => {
    const scenarios = [makeScenario({ id: 'a' }), makeScenario({ id: 'b', metrics: { totalCashOutflow: 40000 } })]
    const winners = determineCriterionWinners(scenarios, CRITERIA)
    expect(winners).toHaveLength(CRITERIA.length)
  })
})
