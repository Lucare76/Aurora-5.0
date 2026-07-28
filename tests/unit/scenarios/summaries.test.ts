import { describe, expect, it } from 'vitest'
import { assessReliability, buildResultSummary, computeDataCompleteness } from '@/lib/scenarios/summaries'
import type { FinancialScenario, ScenarioProjectionResult, ScenarioReliability } from '@/lib/scenarios/types'

function makeScenario(overrides: Partial<Pick<FinancialScenario, 'horizon_months' | 'actions'>> = {}): FinancialScenario {
  return {
    id: 'scenario-1',
    user_id: 'user-1',
    name: 'Test',
    description: null,
    status: 'draft',
    horizon_months: 12,
    start_date: '2026-08-01',
    end_date: '2027-07-31',
    currency: 'EUR',
    actions: [],
    assumptions: {
      includeActiveRecurring: true,
      includeGoalContributions: true,
      goalContributionSource: 'recent_average',
      loanPaymentSource: 'recent_average',
      excludedAccountIds: [],
    },
    engine_version: '1.0.0',
    schema_version: 1,
    action_registry_version: '1.0.0',
    baseline_as_of: null,
    last_calculated_at: null,
    result_summary: null,
    is_favorite: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeProjection(overrides: Partial<ScenarioProjectionResult> = {}): ScenarioProjectionResult {
  return {
    months: [],
    baselineFinalBalance: 5000,
    baselineMinBalance: 2000,
    baselineTotalIncome: 24000,
    baselineTotalExpenses: 14400,
    baselineNegativeMonths: 0,
    baselineFirstNegativeMonth: null,
    scenarioFinalBalance: 5000,
    scenarioMinBalance: 2000,
    scenarioTotalIncome: 24000,
    scenarioTotalExpenses: 14400,
    scenarioNegativeMonths: 0,
    scenarioFirstNegativeMonth: null,
    totalDelta: 0,
    initialBalanceAdjustment: 0,
    ...overrides,
  }
}

function makeReliability(overrides: Partial<ScenarioReliability> = {}): ScenarioReliability {
  return { level: 'high', reasons: [], warnings: [], dataCompleteness: 100, ...overrides }
}

// ── assessReliability ─────────────────────────────────────────────────────────

describe('assessReliability', () => {
  it('returns high level with full data and short horizon', () => {
    const result = assessReliability(makeScenario({ horizon_months: 12 }), true, true, 100)
    expect(result.level).toBe('high')
    expect(result.warnings).toHaveLength(0)
  })

  it('returns medium level when horizon is 13-24', () => {
    const result = assessReliability(makeScenario({ horizon_months: 18 }), true, true, 90)
    expect(result.level).toBe('medium')
  })

  it('warns when horizon exceeds 24 months', () => {
    const result = assessReliability(makeScenario({ horizon_months: 36 }), true, true, 90)
    expect(result.warnings.some((w) => w.includes('24 mesi'))).toBe(true)
  })

  it('warns when no recent transactions', () => {
    const result = assessReliability(makeScenario({ horizon_months: 6 }), false, true, 60)
    expect(result.warnings.some((w) => w.includes('transazione'))).toBe(true)
  })

  it('warns when no active recurring rules', () => {
    const result = assessReliability(makeScenario({ horizon_months: 6 }), true, false, 70)
    expect(result.warnings.some((w) => w.includes('ricorrente'))).toBe(true)
  })

  it('returns limited level when 2+ warnings and horizon > 24', () => {
    const result = assessReliability(makeScenario({ horizon_months: 48 }), false, false, 40)
    // 3 warnings: long horizon + no transactions + no recurring
    expect(result.level).toBe('limited')
  })

  it('adds reason when no actions configured', () => {
    const result = assessReliability(makeScenario({ actions: [] }), true, true, 100)
    expect(result.reasons.some((r) => r.includes('Nessuna azione'))).toBe(true)
  })

  it('clamps dataCompleteness to 0-100 range', () => {
    const over = assessReliability(makeScenario(), true, true, 150)
    expect(over.dataCompleteness).toBe(100)

    const under = assessReliability(makeScenario(), false, false, -10)
    expect(under.dataCompleteness).toBe(0)
  })
})

// ── buildResultSummary ────────────────────────────────────────────────────────

describe('buildResultSummary', () => {
  it('describes improvement when totalDelta is positive', () => {
    const summary = buildResultSummary(makeProjection({ totalDelta: 1200 }), makeReliability())
    expect(summary).toContain('migliora')
  })

  it('describes reduction when totalDelta is negative', () => {
    const summary = buildResultSummary(makeProjection({ totalDelta: -800 }), makeReliability())
    expect(summary).toContain('riduce')
  })

  it('describes no change when totalDelta is zero', () => {
    const summary = buildResultSummary(makeProjection({ totalDelta: 0 }), makeReliability())
    expect(summary).toContain('non modifica')
  })

  it('warns about negative months in scenario', () => {
    const summary = buildResultSummary(makeProjection({ scenarioNegativeMonths: 2 }), makeReliability())
    expect(summary).toContain('saldo negativo')
  })

  it('calls out eliminating negative baseline months', () => {
    const summary = buildResultSummary(
      makeProjection({ baselineNegativeMonths: 3, scenarioNegativeMonths: 0 }),
      makeReliability(),
    )
    expect(summary).toContain('elimina')
  })

  it('notes limited reliability in summary text', () => {
    const summary = buildResultSummary(makeProjection(), makeReliability({ level: 'limited' }))
    expect(summary).toContain('Attendibilità limitata')
  })

  it('does not add reliability note for high level', () => {
    const summary = buildResultSummary(makeProjection(), makeReliability({ level: 'high' }))
    expect(summary).not.toContain('Attendibilità limitata')
  })
})

// ── computeDataCompleteness ───────────────────────────────────────────────────

describe('computeDataCompleteness', () => {
  it('returns 40 base score with no data and short horizon', () => {
    expect(computeDataCompleteness(false, false, false, false, 12)).toBe(40)
  })

  it('adds 25 for recent transactions', () => {
    expect(computeDataCompleteness(true, false, false, false, 12)).toBe(65)
  })

  it('adds 20 for active recurring', () => {
    expect(computeDataCompleteness(false, true, false, false, 12)).toBe(60)
  })

  it('adds 8 for loan data', () => {
    expect(computeDataCompleteness(false, false, true, false, 12)).toBe(48)
  })

  it('adds 7 for goal data', () => {
    expect(computeDataCompleteness(false, false, false, true, 12)).toBe(47)
  })

  it('returns full score (100) with all data and 12-month horizon', () => {
    expect(computeDataCompleteness(true, true, true, true, 12)).toBe(100)
  })

  it('applies penalty for horizons beyond 12 months', () => {
    // horizon = 60: penalty = (60-12)/48 * 20 = 20
    const score = computeDataCompleteness(true, true, true, true, 60)
    expect(score).toBe(80)
  })

  it('no penalty when horizon is exactly 12', () => {
    const score = computeDataCompleteness(true, true, false, false, 12)
    expect(score).toBe(85) // 40 + 25 + 20
  })
})
