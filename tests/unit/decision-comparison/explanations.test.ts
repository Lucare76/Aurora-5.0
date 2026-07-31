import { describe, expect, it } from 'vitest'
import {
  buildCompatibilityExplanation,
  buildCriterionWinnerExplanations,
  buildDisclaimer,
  buildDominanceExplanations,
  buildExplanations,
  buildRankingExplanation,
  buildTradeoffExplanations,
} from '@/lib/decision-comparison/explanations'
import { DISCLAIMER } from '@/lib/decision-comparison/constants'
import type { CompatibilityResult, CriterionWinner, DominanceRelation, RankedScenario, TradeoffSummary } from '@/lib/decision-comparison/types'
import { makeScenario } from './fixtures'

describe('buildCompatibilityExplanation', () => {
  it('describes a FULL comparison', () => {
    const compat: CompatibilityResult = { level: 'FULL', sameType: true, currency: 'EUR', usableCriteria: [] }
    expect(buildCompatibilityExplanation(compat)).toMatch(/completo/i)
  })

  it('describes a FINANCIAL_ONLY comparison', () => {
    const compat: CompatibilityResult = { level: 'FINANCIAL_ONLY', sameType: false, currency: 'EUR', usableCriteria: [] }
    expect(buildCompatibilityExplanation(compat)).toMatch(/finanziario trasversale/i)
  })
})

describe('buildRankingExplanation', () => {
  it('orders scenarios by rank and includes scores', () => {
    const scenarios = [makeScenario({ id: 'a', name: 'Auto A' }), makeScenario({ id: 'b', name: 'Auto B' })]
    const ranking: RankedScenario[] = [
      { scenarioId: 'b', rank: 1, finalScore: 90, isTie: false, tiedWithScenarioIds: [] },
      { scenarioId: 'a', rank: 2, finalScore: 60, isTie: false, tiedWithScenarioIds: [] },
    ]
    const text = buildRankingExplanation(ranking, scenarios)
    expect(text.indexOf('Auto B')).toBeLessThan(text.indexOf('Auto A'))
    expect(text).toContain('90.0')
  })

  it('mentions a tie when present', () => {
    const scenarios = [makeScenario({ id: 'a' }), makeScenario({ id: 'b' })]
    const ranking: RankedScenario[] = [
      { scenarioId: 'a', rank: 1, finalScore: 70, isTie: true, tiedWithScenarioIds: ['b'] },
      { scenarioId: 'b', rank: 1, finalScore: 70, isTie: true, tiedWithScenarioIds: ['a'] },
    ]
    expect(buildRankingExplanation(ranking, scenarios)).toMatch(/parità/i)
  })
})

describe('buildCriterionWinnerExplanations', () => {
  const scenarios = [makeScenario({ id: 'a', name: 'A' }), makeScenario({ id: 'b', name: 'B' })]

  it('names the winner when there is one', () => {
    const winners: CriterionWinner[] = [
      { criterion: 'totalCashOutflow', winnerScenarioId: 'a', isTie: false, isNegligibleDifference: false, values: [] },
    ]
    expect(buildCriterionWinnerExplanations(winners, scenarios)[0]).toContain('"A"')
  })

  it('reports a negligible difference distinctly from insufficient data', () => {
    const negligible: CriterionWinner[] = [
      { criterion: 'totalCashOutflow', winnerScenarioId: null, isTie: true, isNegligibleDifference: true, values: [] },
    ]
    expect(buildCriterionWinnerExplanations(negligible, scenarios)[0]).toMatch(/trascurabile/i)

    const insufficient: CriterionWinner[] = [
      { criterion: 'totalCashOutflow', winnerScenarioId: null, isTie: false, isNegligibleDifference: false, values: [] },
    ]
    expect(buildCriterionWinnerExplanations(insufficient, scenarios)[0]).toMatch(/dati insufficienti/i)
  })
})

describe('buildDominanceExplanations', () => {
  it('names dominant and dominated scenarios with the margin count', () => {
    const scenarios = [makeScenario({ id: 'a', name: 'A' }), makeScenario({ id: 'b', name: 'B' })]
    const dominance: DominanceRelation[] = [
      { dominantScenarioId: 'a', dominatedScenarioId: 'b', marginCriteria: ['totalCashOutflow', 'residualLiquidity'] },
    ]
    const text = buildDominanceExplanations(dominance, scenarios)[0]
    expect(text).toContain('"A"')
    expect(text).toContain('"B"')
    expect(text).toContain('2')
  })

  it('returns an empty array when there is no dominance', () => {
    expect(buildDominanceExplanations([], [])).toEqual([])
  })
})

describe('buildTradeoffExplanations', () => {
  const scenarios = [makeScenario({ id: 'a', name: 'A' }), makeScenario({ id: 'b', name: 'B' })]

  it('describes a genuine trade-off', () => {
    const tradeoffs: TradeoffSummary[] = [
      { scenarioAId: 'a', scenarioBId: 'b', aWinsOn: ['totalCashOutflow'], bWinsOn: ['residualLiquidity'], tiedOn: [], isDominance: false },
    ]
    const text = buildTradeoffExplanations(tradeoffs, scenarios)[0]
    expect(text).toContain('"A"')
    expect(text).toContain('"B"')
  })

  it('omits pairs that are dominance relations', () => {
    const tradeoffs: TradeoffSummary[] = [
      { scenarioAId: 'a', scenarioBId: 'b', aWinsOn: ['totalCashOutflow'], bWinsOn: [], tiedOn: [], isDominance: true },
    ]
    expect(buildTradeoffExplanations(tradeoffs, scenarios)).toEqual([])
  })

  it('omits pairs with no wins on either side (pure parity)', () => {
    const tradeoffs: TradeoffSummary[] = [
      { scenarioAId: 'a', scenarioBId: 'b', aWinsOn: [], bWinsOn: [], tiedOn: ['totalCashOutflow'], isDominance: false },
    ]
    expect(buildTradeoffExplanations(tradeoffs, scenarios)).toEqual([])
  })
})

describe('buildDisclaimer', () => {
  it('matches the shared DISCLAIMER constant', () => {
    expect(buildDisclaimer()).toBe(DISCLAIMER)
  })
})

describe('buildExplanations', () => {
  it('assembles compatibility, ranking, winners, dominance, tradeoffs and disclaimer in order', () => {
    const scenarios = [makeScenario({ id: 'a', name: 'A' }), makeScenario({ id: 'b', name: 'B' })]
    const compatibility: CompatibilityResult = { level: 'FULL', sameType: true, currency: 'EUR', usableCriteria: [] }
    const ranking: RankedScenario[] = [
      { scenarioId: 'a', rank: 1, finalScore: 80, isTie: false, tiedWithScenarioIds: [] },
      { scenarioId: 'b', rank: 2, finalScore: 50, isTie: false, tiedWithScenarioIds: [] },
    ]
    const criterionWinners: CriterionWinner[] = [
      { criterion: 'totalCashOutflow', winnerScenarioId: 'a', isTie: false, isNegligibleDifference: false, values: [] },
    ]
    const dominance: DominanceRelation[] = [{ dominantScenarioId: 'a', dominatedScenarioId: 'b', marginCriteria: ['totalCashOutflow'] }]
    const tradeoffs: TradeoffSummary[] = []

    const explanations = buildExplanations({ compatibility, ranking, criterionWinners, dominance, tradeoffs, scenarios })

    expect(explanations[0]).toMatch(/completo/i)
    expect(explanations[explanations.length - 1]).toBe(DISCLAIMER)
    expect(explanations.length).toBe(1 + 1 + criterionWinners.length + dominance.length + 0 + 1)
  })
})
