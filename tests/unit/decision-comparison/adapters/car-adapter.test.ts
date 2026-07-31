import { describe, expect, it } from 'vitest'
import { adaptCarScenario } from '@/lib/decision-comparison/adapters/car-adapter'
import type { AffordabilityDbData } from '@/lib/affordability/types'
import type { CarInput } from '@/lib/affordability/car/types'
import type { Account } from '@/types/database'

const NOW = new Date('2026-07-01T00:00:00Z')

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-1', user_id: 'user-1', name: 'Conto corrente', type: 'checking', color: null, icon: null,
    balance: 30000, currency: 'EUR', is_active: true, is_hidden: false, sort_order: 0,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...overrides,
  }
}

function db(overrides: Partial<AffordabilityDbData> = {}): AffordabilityDbData {
  return {
    accounts: [account()],
    recurringRules: [
      { id: 'rule-1', type: 'income', amount: 3000, frequency: 'monthly', start_date: '2025-01-01', end_date: null, next_due_date: '2026-07-01', is_active: true },
      { id: 'rule-2', type: 'expense', amount: 1500, frequency: 'monthly', start_date: '2025-01-01', end_date: null, next_due_date: '2026-07-01', is_active: true },
    ],
    recentTransactions: [
      { id: 'tx-1', type: 'income', amount: 3000, date: '2026-06-15', transfer_peer_id: null },
      { id: 'tx-2', type: 'expense', amount: 1500, date: '2026-06-15', transfer_peer_id: null },
      { id: 'tx-3', type: 'income', amount: 3000, date: '2026-05-15', transfer_peer_id: null },
      { id: 'tx-4', type: 'expense', amount: 1500, date: '2026-05-15', transfer_peer_id: null },
    ],
    loans: [], loanPayments: [], goals: [], goalContributions: [],
    ...overrides,
  }
}

function immediateInput(overrides: Partial<CarInput> = {}): CarInput {
  return {
    carName: 'Toyota Yaris Hybrid',
    purchasePrice: 25000,
    paymentMode: 'IMMEDIATE',
    purchaseDate: '2026-07-01',
    currency: 'EUR',
    ownershipYears: 5,
    annualKm: 15000,
    insurance: { rcAnnual: 800 },
    tax: { bolloAnnual: 200 },
    fuel: { mode: 'monthly_estimate', monthlyEstimate: 100 },
    maintenance: { ordinaryAnnual: 300 },
    estimatedResidualValue: 8000,
    ...overrides,
  }
}

function financingInput(overrides: Partial<CarInput> = {}): CarInput {
  return immediateInput({
    paymentMode: 'FINANCING',
    downPayment: 5000,
    installmentAmount: 400,
    numberOfInstallments: 60,
    financingFees: 500,
    ...overrides,
  })
}

describe('adaptCarScenario', () => {
  it('produces a CAR_PURCHASE normalized scenario', () => {
    const scenario = adaptCarScenario({ id: 'c1', input: immediateInput(), dbData: db(), now: NOW })
    expect(scenario.type).toBe('CAR_PURCHASE')
    expect(scenario.currency).toBe('EUR')
  })

  it('defaults the name to carName when not provided', () => {
    const scenario = adaptCarScenario({ id: 'c1', input: immediateInput({ carName: 'Panda' }), dbData: db(), now: NOW })
    expect(scenario.name).toBe('Panda')
  })

  it('honors an explicit name override', () => {
    const scenario = adaptCarScenario({ id: 'c1', name: 'Auto A', input: immediateInput(), dbData: db(), now: NOW })
    expect(scenario.name).toBe('Auto A')
  })

  it('maps estimatedResidualValue from carMetrics.residualValue', () => {
    const scenario = adaptCarScenario({ id: 'c1', input: immediateInput({ estimatedResidualValue: 9000 }), dbData: db(), now: NOW })
    expect(scenario.metrics.estimatedResidualValue).toBe(9000)
    expect(scenario.missingMetrics).not.toContain('estimatedResidualValue')
  })

  it('computes netTotalCost as totalCashOutflow minus residual value', () => {
    const scenario = adaptCarScenario({ id: 'c1', input: immediateInput(), dbData: db(), now: NOW })
    expect(scenario.metrics.netTotalCost).toBeCloseTo(
      scenario.metrics.totalCashOutflow - scenario.metrics.estimatedResidualValue,
      2,
    )
  })

  it('does not flag remainingDebtAtEnd for IMMEDIATE payment mode', () => {
    const scenario = adaptCarScenario({ id: 'c1', input: immediateInput(), dbData: db(), now: NOW })
    expect(scenario.missingMetrics).not.toContain('remainingDebtAtEnd')
    expect(scenario.metrics.remainingDebtAtEnd).toBe(0)
  })

  it('flags remainingDebtAtEnd as missing for FINANCING payment mode', () => {
    const scenario = adaptCarScenario({ id: 'c1', input: financingInput(), dbData: db(), now: NOW })
    expect(scenario.missingMetrics).toContain('remainingDebtAtEnd')
  })

  it('maps totalFinancingCost from carMetrics.financingTotalCost', () => {
    const scenario = adaptCarScenario({ id: 'c1', input: financingInput(), dbData: db(), now: NOW })
    expect(scenario.metrics.totalFinancingCost).toBeGreaterThan(0)
  })

  it('totalFinancingCost is 0 for IMMEDIATE payment mode', () => {
    const scenario = adaptCarScenario({ id: 'c1', input: immediateInput(), dbData: db(), now: NOW })
    expect(scenario.metrics.totalFinancingCost).toBe(0)
  })

  it('does not mutate the input or dbData objects', () => {
    const input = immediateInput()
    const data = db()
    const inputBefore = JSON.stringify(input)
    const dbBefore = JSON.stringify(data)
    adaptCarScenario({ id: 'c1', input, dbData: data, now: NOW })
    expect(JSON.stringify(input)).toBe(inputBefore)
    expect(JSON.stringify(data)).toBe(dbBefore)
  })
})
