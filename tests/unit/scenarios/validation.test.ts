import { describe, expect, it } from 'vitest'
import { validateScenario } from '@/lib/scenarios/validation'
import type { FinancialScenario, ScenarioAction } from '@/lib/scenarios/types'

function makeScenario(overrides: Partial<FinancialScenario> = {}): FinancialScenario {
  return {
    id: 'scenario-1',
    user_id: 'user-1',
    name: 'Test Scenario',
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

function makeAction(id: string, code: ScenarioAction['code'], enabled = true, params: Record<string, unknown> = {}): ScenarioAction {
  return { id, code, enabled, params }
}

describe('validateScenario', () => {
  it('returns valid with no issues for a clean scenario', () => {
    const result = validateScenario(makeScenario())
    expect(result.valid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('errors when horizon_months is 0', () => {
    const result = validateScenario(makeScenario({ horizon_months: 0 }))
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'INVALID_HORIZON' && i.severity === 'error')).toBe(true)
  })

  it('errors when horizon_months exceeds MAX_HORIZON_MONTHS (60)', () => {
    const result = validateScenario(makeScenario({ horizon_months: 61 }))
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'INVALID_HORIZON')).toBe(true)
  })

  it('accepts horizon_months at boundary values (1 and 60)', () => {
    expect(validateScenario(makeScenario({ horizon_months: 1 })).valid).toBe(true)
    expect(validateScenario(makeScenario({ horizon_months: 60 })).valid).toBe(true)
  })

  it('errors when actions exceed MAX_ACTIONS_PER_SCENARIO (50)', () => {
    const actions = Array.from({ length: 51 }, (_, i) =>
      makeAction(`a-${i}`, 'ONE_TIME_EXPENSE', true, { amount: 100, date: '2026-08-01', description: 'x' }),
    )
    const result = validateScenario(makeScenario({ actions }))
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'TOO_MANY_ACTIONS')).toBe(true)
  })

  it('errors on unknown action code', () => {
    const action = makeAction('a-1', 'ONE_TIME_EXPENSE')
    action.code = 'INVALID_CODE' as never
    const result = validateScenario(makeScenario({ actions: [action] }))
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'UNKNOWN_ACTION_CODE' && i.actionId === 'a-1')).toBe(true)
  })

  it('warns on RECURRING_EXPENSE_UPDATE + RECURRING_EXPENSE_REMOVE for same ruleId', () => {
    const actions = [
      makeAction('a-1', 'RECURRING_EXPENSE_UPDATE', true, { ruleId: 'rule-1', newAmount: 200, startDate: '2026-08-01' }),
      makeAction('a-2', 'RECURRING_EXPENSE_REMOVE', true, { ruleId: 'rule-1', startDate: '2026-08-01' }),
    ]
    const result = validateScenario(makeScenario({ actions }))
    expect(result.valid).toBe(true) // warnings don't make it invalid
    expect(result.issues.some((i) => i.code === 'CONFLICTING_ACTIONS' && i.severity === 'warning')).toBe(true)
  })

  it('does not warn on conflicting codes for different ruleIds', () => {
    const actions = [
      makeAction('a-1', 'RECURRING_EXPENSE_UPDATE', true, { ruleId: 'rule-1', newAmount: 200, startDate: '2026-08-01' }),
      makeAction('a-2', 'RECURRING_EXPENSE_REMOVE', true, { ruleId: 'rule-2', startDate: '2026-08-01' }),
    ]
    const result = validateScenario(makeScenario({ actions }))
    expect(result.valid).toBe(true)
    expect(result.issues.filter((i) => i.code === 'CONFLICTING_ACTIONS')).toHaveLength(0)
  })

  it('ignores disabled actions when checking conflicts', () => {
    const actions = [
      makeAction('a-1', 'RECURRING_EXPENSE_UPDATE', false, { ruleId: 'rule-1', newAmount: 200, startDate: '2026-08-01' }),
      makeAction('a-2', 'RECURRING_EXPENSE_REMOVE', false, { ruleId: 'rule-1', startDate: '2026-08-01' }),
    ]
    const result = validateScenario(makeScenario({ actions }))
    expect(result.valid).toBe(true)
    expect(result.issues.filter((i) => i.code === 'CONFLICTING_ACTIONS')).toHaveLength(0)
  })

  it('warns on duplicate action code for same entity', () => {
    const actions = [
      makeAction('a-1', 'RECURRING_EXPENSE_UPDATE', true, { ruleId: 'rule-1', newAmount: 200, startDate: '2026-08-01' }),
      makeAction('a-2', 'RECURRING_EXPENSE_UPDATE', true, { ruleId: 'rule-1', newAmount: 300, startDate: '2026-08-01' }),
    ]
    const result = validateScenario(makeScenario({ actions }))
    expect(result.issues.some((i) => i.code === 'DUPLICATE_ACTION' && i.actionId === 'a-2')).toBe(true)
  })

  it('does not warn on same code for different entities', () => {
    const actions = [
      makeAction('a-1', 'RECURRING_EXPENSE_UPDATE', true, { ruleId: 'rule-1', newAmount: 200, startDate: '2026-08-01' }),
      makeAction('a-2', 'RECURRING_EXPENSE_UPDATE', true, { ruleId: 'rule-2', newAmount: 300, startDate: '2026-08-01' }),
    ]
    const result = validateScenario(makeScenario({ actions }))
    expect(result.issues.filter((i) => i.code === 'DUPLICATE_ACTION')).toHaveLength(0)
  })

  it('accumulates multiple independent issues', () => {
    const result = validateScenario(makeScenario({ horizon_months: 0, actions: Array.from({ length: 51 }, (_, i) => makeAction(`a-${i}`, 'ONE_TIME_EXPENSE', true, { amount: 10, date: '2026-08-01', description: 'x' })) }))
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'INVALID_HORIZON')).toBe(true)
    expect(result.issues.some((i) => i.code === 'TOO_MANY_ACTIONS')).toBe(true)
  })
})
