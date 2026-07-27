import { describe, it, expect } from 'vitest'
import { generatePeriods } from '@/lib/scenarios/dates'
import { buildBaseline } from '@/lib/scenarios/baseline'
import { projectScenario } from '@/lib/scenarios/projection'
import { DEFAULT_ASSUMPTIONS } from '@/lib/scenarios/assumptions'
import type { FinancialScenario } from '@/lib/scenarios/types'
import type { Account, RecurringRule } from '@/types/database'

// ── Minimal fixtures ──────────────────────────────────────────────────────────

const account: Account = {
  id: 'acc-1', user_id: 'user-1', name: 'Conto', type: 'checking',
  balance: 5000, currency: 'EUR', is_active: true, is_hidden: false,
  color: null, icon: null, sort_order: 0,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}

const incomeRule: RecurringRule = {
  id: 'rule-income', user_id: 'user-1', account_id: 'acc-1',
  category_id: 'cat-income', type: 'income', amount: 2000,
  description: 'Stipendio', frequency: 'monthly',
  start_date: '2026-01-01', end_date: null, next_due_date: '2026-01-31',
  last_run_date: null, is_active: true, auto_create: false,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}

const expenseRule: RecurringRule = {
  id: 'rule-expense', user_id: 'user-1', account_id: 'acc-1',
  category_id: 'cat-expense', type: 'expense', amount: 1500,
  description: 'Affitto', frequency: 'monthly',
  start_date: '2026-01-01', end_date: null, next_due_date: '2026-01-01',
  last_run_date: null, is_active: true, auto_create: false,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}

function makeScenario(actions: FinancialScenario['actions']): FinancialScenario {
  return {
    id: 'sc-1', user_id: 'user-1', name: 'Test', description: null,
    status: 'draft', horizon_months: 3, start_date: '2026-01-01', end_date: '2026-03-31',
    currency: 'EUR', actions, assumptions: DEFAULT_ASSUMPTIONS,
    engine_version: '1.0.0', schema_version: 1, action_registry_version: '1.0.0',
    baseline_as_of: null, last_calculated_at: null, result_summary: null,
    is_favorite: false, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  }
}

const periods = generatePeriods('2026-01-01', 3)

function buildTestBaseline() {
  return buildBaseline(
    periods, [account], [incomeRule, expenseRule],
    [], [], [], [], DEFAULT_ASSUMPTIONS,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('projectScenario — no actions', () => {
  it('scenario equals baseline when no actions', () => {
    const baseline = buildTestBaseline()
    const scenario = makeScenario([])
    const result = projectScenario(scenario, periods, baseline, [incomeRule, expenseRule], [], [], [], [])

    for (const month of result.months) {
      expect(month.scenarioClosingBalance).toBe(month.baselineClosingBalance)
      expect(month.delta).toBe(0)
    }
    expect(result.totalDelta).toBe(0)
  })
})

describe('projectScenario — one-time expense', () => {
  it('reduces closing balance in the target month', () => {
    const baseline = buildTestBaseline()
    const scenario = makeScenario([
      {
        id: 'a1', code: 'ONE_TIME_EXPENSE', enabled: true, label: null,
        params: { amount: 1000, date: '2026-02-15', description: 'Test expense' },
      },
    ])
    const result = projectScenario(scenario, periods, baseline, [incomeRule, expenseRule], [], [], [], [])

    const febIdx = result.months.findIndex((m) => m.period.key === '2026-02')
    const feb = result.months[febIdx]

    expect(feb.scenarioExpenses).toBe(feb.baselineExpenses + 1000)
    expect(feb.delta).toBeLessThan(0) // negative delta = worse balance
    expect(result.totalDelta).toBeLessThan(0)
  })
})

describe('projectScenario — disabled action is ignored', () => {
  it('disabled action produces no changes', () => {
    const baseline = buildTestBaseline()
    const scenario = makeScenario([
      {
        id: 'a2', code: 'ONE_TIME_EXPENSE', enabled: false, label: null,
        params: { amount: 9999, date: '2026-01-10', description: 'Disabled' },
      },
    ])
    const result = projectScenario(scenario, periods, baseline, [], [], [], [], [])
    expect(result.totalDelta).toBe(0)
  })
})

describe('projectScenario — income action', () => {
  it('monthly income add increases all closing balances', () => {
    const baseline = buildTestBaseline()
    const scenario = makeScenario([
      {
        id: 'a3', code: 'RECURRING_INCOME_ADD', enabled: true, label: null,
        params: { amount: 500, frequency: 'monthly', description: 'Side job', startDate: '2026-01-01' },
      },
    ])
    const result = projectScenario(scenario, periods, baseline, [], [], [], [], [])

    for (const month of result.months) {
      expect(month.scenarioIncome).toBe(month.baselineIncome + 500)
      expect(month.delta).toBeGreaterThan(0)
    }
  })
})

describe('projectScenario — aggregates', () => {
  it('scenarioNegativeMonths reflects negative closing balances', () => {
    const baseline = buildTestBaseline()
    // Add huge one-time expense that causes negative balance
    const scenario = makeScenario([
      {
        id: 'a4', code: 'ONE_TIME_EXPENSE', enabled: true, label: null,
        params: { amount: 50000, date: '2026-01-15', description: 'Giant expense' },
      },
    ])
    const result = projectScenario(scenario, periods, baseline, [], [], [], [], [])
    expect(result.scenarioNegativeMonths).toBeGreaterThan(0)
    expect(result.scenarioFirstNegativeMonth).toBe('2026-01')
  })
})
