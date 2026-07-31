import { describe, expect, it } from 'vitest'
import { scoreScenarios } from '@/lib/decision-comparison/scoring'
import { CRITERION_KEYS, MAX_LIQUIDITY_PENALTY, PROFILE_WEIGHTS } from '@/lib/decision-comparison/constants'
import type { CriterionWeights } from '@/lib/decision-comparison/types'
import { makeScenario } from './fixtures'

function zeroWeights(overrides: Partial<CriterionWeights> = {}): CriterionWeights {
  const out = {} as CriterionWeights
  for (const key of CRITERION_KEYS) out[key] = 0
  return { ...out, ...overrides }
}

describe('scoreScenarios — weighted aggregation', () => {
  it('gives a perfect 100 when a scenario wins every weighted criterion with full confidence', () => {
    const winner = makeScenario({
      id: 'winner',
      metrics: { totalCashOutflow: 1000, dataQualityScore: 100, confidenceLevel: 100 },
    })
    const loser = makeScenario({
      id: 'loser',
      metrics: { totalCashOutflow: 5000, dataQualityScore: 100, confidenceLevel: 100 },
    })
    const scores = scoreScenarios([winner, loser], zeroWeights({ totalCashOutflow: 1 }))
    const winnerScore = scores.find((s) => s.scenarioId === 'winner')!
    expect(winnerScore.finalScore).toBe(100)
  })

  it('blends multiple weighted criteria proportionally', () => {
    const a = makeScenario({ id: 'a', metrics: { totalCashOutflow: 0, residualLiquidity: 100 } })
    const b = makeScenario({ id: 'b', metrics: { totalCashOutflow: 100, residualLiquidity: 0 } })
    const weights = zeroWeights({ totalCashOutflow: 0.5, residualLiquidity: 0.5 })
    const scores = scoreScenarios([a, b], weights)
    // a: 100% on cost (lower is better) + 100% on liquidity => rawWeightedScore 100
    // b: 0% on both => rawWeightedScore 0
    expect(scores.find((s) => s.scenarioId === 'a')!.rawWeightedScore).toBe(100)
    expect(scores.find((s) => s.scenarioId === 'b')!.rawWeightedScore).toBe(0)
  })

  it('applies all built-in profile weight sets without throwing and within [0,100]', () => {
    const scenarios = [makeScenario({ id: 'a' }), makeScenario({ id: 'b', metrics: { totalCashOutflow: 25000 } })]
    for (const profile of Object.keys(PROFILE_WEIGHTS) as Array<keyof typeof PROFILE_WEIGHTS>) {
      const scores = scoreScenarios(scenarios, PROFILE_WEIGHTS[profile])
      for (const s of scores) {
        expect(s.finalScore).toBeGreaterThanOrEqual(0)
        expect(s.finalScore).toBeLessThanOrEqual(100)
      }
    }
  })
})

describe('scoreScenarios — liquidity penalty', () => {
  it('applies a flat penalty per critical month', () => {
    const scenario = makeScenario({ id: 'a', metrics: { criticalMonthsCount: 2 } })
    const other = makeScenario({ id: 'b', metrics: { criticalMonthsCount: 0 } })
    const scores = scoreScenarios([scenario, other], zeroWeights())
    expect(scores.find((s) => s.scenarioId === 'a')!.liquidityPenalty).toBe(8) // 2 * CRITICAL_MONTH_PENALTY(4)
    expect(scores.find((s) => s.scenarioId === 'b')!.liquidityPenalty).toBe(0)
  })

  it('caps the liquidity penalty at MAX_LIQUIDITY_PENALTY', () => {
    const scenario = makeScenario({ id: 'a', metrics: { criticalMonthsCount: 50 } })
    const other = makeScenario({ id: 'b' })
    const scores = scoreScenarios([scenario, other], zeroWeights())
    expect(scores.find((s) => s.scenarioId === 'a')!.liquidityPenalty).toBe(MAX_LIQUIDITY_PENALTY)
  })

  it('never lets the penalized score go negative before the confidence factor', () => {
    const scenario = makeScenario({ id: 'a', metrics: { totalCashOutflow: 5000, criticalMonthsCount: 50 } })
    const other = makeScenario({ id: 'b', metrics: { totalCashOutflow: 1000 } })
    const scores = scoreScenarios([scenario, other], zeroWeights({ totalCashOutflow: 1 }))
    const s = scores.find((sc) => sc.scenarioId === 'a')!
    expect(s.finalScore).toBeGreaterThanOrEqual(0)
  })
})

describe('scoreScenarios — confidence factor', () => {
  it('discounts (but never zeroes) the score for low data quality/confidence', () => {
    const lowConfidence = makeScenario({ id: 'low', metrics: { dataQualityScore: 0, confidenceLevel: 0 } })
    const highConfidence = makeScenario({ id: 'high', metrics: { dataQualityScore: 100, confidenceLevel: 100 } })
    const weights = zeroWeights({ totalCashOutflow: 1 })
    const scores = scoreScenarios([lowConfidence, highConfidence], weights)
    const low = scores.find((s) => s.scenarioId === 'low')!
    const high = scores.find((s) => s.scenarioId === 'high')!
    expect(low.confidenceFactor).toBeCloseTo(0.7, 6)
    expect(high.confidenceFactor).toBeCloseTo(1.0, 6)
    expect(low.finalScore).toBeLessThan(high.finalScore)
  })
})

describe('scoreScenarios — scenario count boundaries', () => {
  it('scores the minimum of 2 scenarios', () => {
    const scores = scoreScenarios([makeScenario({ id: 'a' }), makeScenario({ id: 'b' })], PROFILE_WEIGHTS.BALANCED)
    expect(scores).toHaveLength(2)
  })

  it('scores the maximum of 4 scenarios', () => {
    const scenarios = ['a', 'b', 'c', 'd'].map((id) => makeScenario({ id }))
    const scores = scoreScenarios(scenarios, PROFILE_WEIGHTS.BALANCED)
    expect(scores).toHaveLength(4)
  })
})

describe('scoreScenarios — immutability', () => {
  it('does not mutate the input scenarios or weights', () => {
    const scenarios = [makeScenario({ id: 'a' }), makeScenario({ id: 'b' })]
    const weights = { ...PROFILE_WEIGHTS.BALANCED }
    const scenariosBefore = JSON.stringify(scenarios)
    const weightsBefore = JSON.stringify(weights)
    scoreScenarios(scenarios, weights)
    expect(JSON.stringify(scenarios)).toBe(scenariosBefore)
    expect(JSON.stringify(weights)).toBe(weightsBefore)
  })
})
