import { describe, it, expect } from 'vitest'
import { buildComparison } from '@/lib/scenarios/comparison'
import type { ScenarioProjectionResult } from '@/lib/scenarios/types'

function makeProjection(
  opts: Partial<ScenarioProjectionResult> = {},
): ScenarioProjectionResult {
  return {
    months: [],
    baselineFinalBalance: 1000,
    baselineMinBalance: 500,
    baselineTotalIncome: 6000,
    baselineTotalExpenses: 5000,
    baselineNegativeMonths: 0,
    baselineFirstNegativeMonth: null,
    scenarioFinalBalance: 1200,
    scenarioMinBalance: 600,
    scenarioTotalIncome: 6000,
    scenarioTotalExpenses: 4800,
    scenarioNegativeMonths: 0,
    scenarioFirstNegativeMonth: null,
    totalDelta: 200,
    initialBalanceAdjustment: 0,
    ...opts,
  }
}

describe('buildComparison', () => {
  it('computes positive direction when scenario > baseline', () => {
    const cmp = buildComparison(makeProjection(), null, null)
    expect(cmp.finalBalance.delta).toBe(200)
    expect(cmp.finalBalance.direction).toBe('positive')
  })

  it('computes negative direction when scenario < baseline', () => {
    const cmp = buildComparison(
      makeProjection({ scenarioFinalBalance: 800, totalDelta: -200 }),
      null, null,
    )
    expect(cmp.finalBalance.delta).toBe(-200)
    expect(cmp.finalBalance.direction).toBe('negative')
  })

  it('neutral direction when delta = 0', () => {
    const cmp = buildComparison(
      makeProjection({ scenarioFinalBalance: 1000, totalDelta: 0 }),
      null, null,
    )
    expect(cmp.finalBalance.direction).toBe('neutral')
  })

  it('includes financialHealthScore metric when both scores provided', () => {
    const cmp = buildComparison(makeProjection(), 70, 85)
    expect(cmp.financialHealthScore).not.toBeNull()
    expect(cmp.financialHealthScore?.delta).toBe(15)
    expect(cmp.financialHealthScore?.direction).toBe('positive')
  })

  it('summary mentions improvement when delta > 0', () => {
    const cmp = buildComparison(makeProjection(), null, null)
    expect(cmp.summary).toMatch(/migliora/)
  })

  it('summary mentions reduction when delta < 0', () => {
    const cmp = buildComparison(
      makeProjection({ scenarioFinalBalance: 800, totalDelta: -200 }),
      null, null,
    )
    expect(cmp.summary).toMatch(/riduce/)
  })

  it('negativeMonths direction is negative when scenario has more', () => {
    const cmp = buildComparison(
      makeProjection({ scenarioNegativeMonths: 2, baselineNegativeMonths: 0 }),
      null, null,
    )
    expect(cmp.negativeMonths.direction).toBe('negative')
  })

  it('all required metric keys are present', () => {
    const cmp = buildComparison(makeProjection(), null, null)
    const keys = cmp.metrics.map((m) => m.key)
    expect(keys).toContain('final_balance')
    expect(keys).toContain('minimum_balance')
    expect(keys).toContain('avg_cash_flow')
    expect(keys).toContain('total_income')
    expect(keys).toContain('total_expenses')
    expect(keys).toContain('negative_months')
  })
})
