import { describe, expect, it } from 'vitest'
import { computeAllCriterionScores, computeCriterionScores } from '@/lib/decision-comparison/normalization'
import { CRITERIA } from '@/lib/decision-comparison/constants'
import type { CriterionDefinition } from '@/lib/decision-comparison/types'
import { makeScenario } from './fixtures'

const lowerIsBetter: CriterionDefinition = {
  key: 'totalCashOutflow',
  label: 'Uscita di cassa totale',
  direction: 'lowerIsBetter',
  category: 'cost',
}

const higherIsBetter: CriterionDefinition = {
  key: 'residualLiquidity',
  label: 'Liquidità residua',
  direction: 'higherIsBetter',
  category: 'liquidity',
}

describe('computeCriterionScores — direction handling', () => {
  it('gives the lowest value 100 for a lowerIsBetter criterion', () => {
    const scenarios = [
      makeScenario({ id: 'a', metrics: { totalCashOutflow: 10000 } }),
      makeScenario({ id: 'b', metrics: { totalCashOutflow: 20000 } }),
    ]
    const scores = computeCriterionScores(scenarios, lowerIsBetter)
    expect(scores[0].normalizedScore).toBe(100)
    expect(scores[1].normalizedScore).toBe(0)
  })

  it('gives the highest value 100 for a higherIsBetter criterion', () => {
    const scenarios = [
      makeScenario({ id: 'a', metrics: { residualLiquidity: 5000 } }),
      makeScenario({ id: 'b', metrics: { residualLiquidity: 15000 } }),
    ]
    const scores = computeCriterionScores(scenarios, higherIsBetter)
    expect(scores[0].normalizedScore).toBe(0)
    expect(scores[1].normalizedScore).toBe(100)
  })

  it('interpolates linearly between min and max', () => {
    const scenarios = [
      makeScenario({ id: 'a', metrics: { residualLiquidity: 0 } }),
      makeScenario({ id: 'b', metrics: { residualLiquidity: 50 } }),
      makeScenario({ id: 'c', metrics: { residualLiquidity: 100 } }),
    ]
    const scores = computeCriterionScores(scenarios, higherIsBetter)
    expect(scores[0].normalizedScore).toBe(0)
    expect(scores[1].normalizedScore).toBe(50)
    expect(scores[2].normalizedScore).toBe(100)
  })
})

describe('computeCriterionScores — parity / ties', () => {
  it('scores every scenario 100 when all present values are equal (true parity)', () => {
    const scenarios = [
      makeScenario({ id: 'a', metrics: { totalCashOutflow: 12000 } }),
      makeScenario({ id: 'b', metrics: { totalCashOutflow: 12000 } }),
    ]
    const scores = computeCriterionScores(scenarios, lowerIsBetter)
    expect(scores.every((s) => s.normalizedScore === 100)).toBe(true)
    expect(scores.every((s) => !s.isMissing)).toBe(true)
  })
})

describe('computeCriterionScores — missing values', () => {
  it('never rewards a missing lowerIsBetter value with the top score', () => {
    const scenarios = [
      makeScenario({ id: 'a', metrics: { totalCashOutflow: 30000 }, missingMetrics: ['totalCashOutflow'] }),
      makeScenario({ id: 'b', metrics: { totalCashOutflow: 10000 } }),
    ]
    const scores = computeCriterionScores(scenarios, lowerIsBetter)
    const missing = scores.find((s) => s.rawValue === null)!
    expect(missing.isMissing).toBe(true)
    expect(missing.normalizedScore).toBe(0)
  })

  it('treats a null metric value (not just missingMetrics) as missing too', () => {
    const scenarios = [
      makeScenario({ id: 'a', metrics: { emergencyFundMonthsAfterDecision: null } }),
      makeScenario({ id: 'b', metrics: { emergencyFundMonthsAfterDecision: 6 } }),
    ]
    const criterion: CriterionDefinition = {
      key: 'emergencyFundMonthsAfterDecision',
      label: 'Mesi di fondo emergenza dopo la decisione',
      direction: 'higherIsBetter',
      category: 'liquidity',
    }
    const scores = computeCriterionScores(scenarios, criterion)
    expect(scores[0].isMissing).toBe(true)
    expect(scores[0].normalizedScore).toBe(0)
    expect(scores[1].normalizedScore).toBe(100)
  })

  it('returns isMissing for everyone when no scenario has the criterion', () => {
    const scenarios = [
      makeScenario({ id: 'a', missingMetrics: ['estimatedResidualValue'] }),
      makeScenario({ id: 'b', missingMetrics: ['estimatedResidualValue'] }),
    ]
    const criterion = CRITERIA.find((c) => c.key === 'estimatedResidualValue')!
    const scores = computeCriterionScores(scenarios, criterion)
    expect(scores.every((s) => s.isMissing)).toBe(true)
    expect(scores.every((s) => s.normalizedScore === 0)).toBe(true)
  })
})

describe('computeAllCriterionScores', () => {
  it('produces one CriterionScore per criterion for every scenario, in scenario order', () => {
    const scenarios = [makeScenario({ id: 'a' }), makeScenario({ id: 'b' }), makeScenario({ id: 'c' })]
    const byScenarioId = computeAllCriterionScores(scenarios, CRITERIA)
    expect(byScenarioId.size).toBe(3)
    for (const scenario of scenarios) {
      const scores = byScenarioId.get(scenario.id)!
      expect(scores).toHaveLength(CRITERIA.length)
      expect(scores.map((s) => s.criterion)).toEqual(CRITERIA.map((c) => c.key))
    }
  })

  it('supports the minimum of 2 scenarios', () => {
    const scenarios = [makeScenario({ id: 'a' }), makeScenario({ id: 'b' })]
    const byScenarioId = computeAllCriterionScores(scenarios, CRITERIA)
    expect(byScenarioId.size).toBe(2)
  })

  it('supports the maximum of 4 scenarios', () => {
    const scenarios = ['a', 'b', 'c', 'd'].map((id) => makeScenario({ id }))
    const byScenarioId = computeAllCriterionScores(scenarios, CRITERIA)
    expect(byScenarioId.size).toBe(4)
  })

  it('does not mutate the input scenarios', () => {
    const scenarios = [makeScenario({ id: 'a' }), makeScenario({ id: 'b' })]
    const before = JSON.stringify(scenarios)
    computeAllCriterionScores(scenarios, CRITERIA)
    expect(JSON.stringify(scenarios)).toBe(before)
  })
})
