import { describe, expect, it } from 'vitest'
import { computeDominance, computeTradeoffs } from '@/lib/decision-comparison/tradeoffs'
import { CRITERION_KEYS } from '@/lib/decision-comparison/constants'
import type { CriterionScore, ScenarioScore } from '@/lib/decision-comparison/types'

function criterionScores(values: number[]): CriterionScore[] {
  return CRITERION_KEYS.map((key, i) => ({
    criterion: key,
    rawValue: values[i] ?? 50,
    normalizedScore: values[i] ?? 50,
    isMissing: false,
  }))
}

function score(scenarioId: string, values: number[]): ScenarioScore {
  return {
    scenarioId,
    criterionScores: criterionScores(values),
    rawWeightedScore: 0,
    liquidityPenalty: 0,
    confidenceFactor: 1,
    finalScore: 0,
  }
}

const N = CRITERION_KEYS.length

describe('computeDominance', () => {
  it('detects A dominating B when A is never worse and better on at least one criterion', () => {
    const a = score('a', Array(N).fill(80))
    const b = score('b', Array(N).fill(60))
    const dominance = computeDominance([a, b])
    expect(dominance).toHaveLength(1)
    expect(dominance[0]).toMatchObject({ dominantScenarioId: 'a', dominatedScenarioId: 'b' })
    expect(dominance[0].marginCriteria).toHaveLength(N)
  })

  it('reports no dominance when scenarios are identical (pure parity)', () => {
    const a = score('a', Array(N).fill(70))
    const b = score('b', Array(N).fill(70))
    expect(computeDominance([a, b])).toHaveLength(0)
  })

  it('reports no dominance when each scenario wins on at least one criterion (a real trade-off)', () => {
    const values = Array(N).fill(50)
    const aValues = [...values]
    aValues[0] = 90 // a wins criterion 0
    const bValues = [...values]
    bValues[1] = 90 // b wins criterion 1
    const a = score('a', aValues)
    const b = score('b', bValues)
    expect(computeDominance([a, b])).toHaveLength(0)
  })

  it('is symmetric-aware: only the winning side is recorded as dominant', () => {
    const a = score('a', Array(N).fill(90))
    const b = score('b', Array(N).fill(10))
    const dominance = computeDominance([a, b])
    expect(dominance.some((d) => d.dominantScenarioId === 'b')).toBe(false)
  })

  it('handles 4 scenarios, finding every dominance pair', () => {
    const scores = [
      score('a', Array(N).fill(100)),
      score('b', Array(N).fill(75)),
      score('c', Array(N).fill(50)),
      score('d', Array(N).fill(25)),
    ]
    const dominance = computeDominance(scores)
    // a dominates b,c,d; b dominates c,d; c dominates d => 6 relations
    expect(dominance).toHaveLength(6)
  })
})

describe('computeTradeoffs', () => {
  it('marks a pair as dominance when computeDominance already found one', () => {
    const a = score('a', Array(N).fill(80))
    const b = score('b', Array(N).fill(60))
    const dominance = computeDominance([a, b])
    const tradeoffs = computeTradeoffs([a, b], dominance)
    expect(tradeoffs[0].isDominance).toBe(true)
  })

  it('lists tied criteria under tiedOn within SCORE_EPSILON', () => {
    const a = score('a', Array(N).fill(50))
    const b = score('b', Array(N).fill(50))
    const tradeoffs = computeTradeoffs([a, b], [])
    expect(tradeoffs[0].tiedOn).toHaveLength(N)
    expect(tradeoffs[0].aWinsOn).toHaveLength(0)
    expect(tradeoffs[0].bWinsOn).toHaveLength(0)
  })

  it('splits wins between aWinsOn and bWinsOn for a genuine trade-off', () => {
    const values = Array(N).fill(50)
    const aValues = [...values]
    aValues[0] = 90
    const bValues = [...values]
    bValues[1] = 90
    const a = score('a', aValues)
    const b = score('b', bValues)
    const tradeoffs = computeTradeoffs([a, b], [])
    expect(tradeoffs[0].aWinsOn).toEqual([CRITERION_KEYS[0]])
    expect(tradeoffs[0].bWinsOn).toEqual([CRITERION_KEYS[1]])
    expect(tradeoffs[0].isDominance).toBe(false)
  })

  it('produces one summary per unordered pair for 4 scenarios', () => {
    const scores = ['a', 'b', 'c', 'd'].map((id) => score(id, Array(N).fill(50)))
    const tradeoffs = computeTradeoffs(scores, [])
    expect(tradeoffs).toHaveLength(6) // C(4,2)
  })

  it('produces exactly one summary for the minimum of 2 scenarios', () => {
    const scores = [score('a', Array(N).fill(50)), score('b', Array(N).fill(50))]
    expect(computeTradeoffs(scores, [])).toHaveLength(1)
  })
})
