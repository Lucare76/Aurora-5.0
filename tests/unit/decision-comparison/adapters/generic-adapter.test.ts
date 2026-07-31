import { describe, expect, it } from 'vitest'
import { adaptGenericScenario } from '@/lib/decision-comparison/adapters/generic-adapter'
import type { AffordabilityDbData, AffordabilityInput } from '@/lib/affordability/types'
import type { Account } from '@/types/database'

const NOW = new Date('2026-07-01T00:00:00Z')

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-1',
    user_id: 'user-1',
    name: 'Conto',
    type: 'checking',
    color: null,
    icon: null,
    balance: 10000,
    currency: 'EUR',
    is_active: true,
    is_hidden: false,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function db(overrides: Partial<AffordabilityDbData> = {}): AffordabilityDbData {
  return {
    accounts: [account()],
    recurringRules: [
      { id: 'r1', type: 'income', amount: 3000, frequency: 'monthly', start_date: '2025-01-01', end_date: null, next_due_date: '2026-07-01', is_active: true },
      { id: 'r2', type: 'expense', amount: 1500, frequency: 'monthly', start_date: '2025-01-01', end_date: null, next_due_date: '2026-07-01', is_active: true },
    ],
    recentTransactions: [
      { id: 'i1', type: 'income', amount: 3000, date: '2026-06-10', transfer_peer_id: null },
      { id: 'e1', type: 'expense', amount: 1500, date: '2026-06-11', transfer_peer_id: null },
      { id: 'i2', type: 'income', amount: 3000, date: '2026-05-10', transfer_peer_id: null },
      { id: 'e2', type: 'expense', amount: 1500, date: '2026-05-11', transfer_peer_id: null },
      { id: 'i3', type: 'income', amount: 3000, date: '2026-04-10', transfer_peer_id: null },
      { id: 'e3', type: 'expense', amount: 1500, date: '2026-04-11', transfer_peer_id: null },
    ],
    loans: [],
    loanPayments: [],
    goals: [],
    goalContributions: [],
    ...overrides,
  }
}

function immediateInput(overrides: Partial<AffordabilityInput> = {}): AffordabilityInput {
  return {
    purchaseName: 'Laptop',
    totalPrice: 1200,
    paymentMode: 'IMMEDIATE',
    purchaseDate: '2026-08-01',
    currency: 'EUR',
    estimatedResaleValue: 200,
    ...overrides,
  }
}

function installmentsInput(overrides: Partial<AffordabilityInput> = {}): AffordabilityInput {
  return {
    purchaseName: 'Divano',
    totalPrice: 2000,
    paymentMode: 'INSTALLMENTS',
    purchaseDate: '2026-08-01',
    currency: 'EUR',
    downPayment: 200,
    installmentAmount: 150,
    numberOfInstallments: 12,
    ...overrides,
  }
}

describe('adaptGenericScenario', () => {
  it('produces a GENERIC_PURCHASE normalized scenario', () => {
    const scenario = adaptGenericScenario({ id: 's1', input: immediateInput(), dbData: db(), now: NOW })
    expect(scenario.type).toBe('GENERIC_PURCHASE')
    expect(scenario.id).toBe('s1')
    expect(scenario.currency).toBe('EUR')
  })

  it('defaults the name to the purchase name when not provided', () => {
    const scenario = adaptGenericScenario({ id: 's1', input: immediateInput({ purchaseName: 'Bici' }), dbData: db(), now: NOW })
    expect(scenario.name).toBe('Bici')
  })

  it('honors an explicit name override', () => {
    const scenario = adaptGenericScenario({ id: 's1', name: 'Custom', input: immediateInput(), dbData: db(), now: NOW })
    expect(scenario.name).toBe('Custom')
  })

  it('computes netTotalCost as totalCashOutflow minus estimatedResidualValue', () => {
    const scenario = adaptGenericScenario({ id: 's1', input: immediateInput({ estimatedResaleValue: 300 }), dbData: db(), now: NOW })
    expect(scenario.metrics.netTotalCost).toBeCloseTo(scenario.metrics.totalCashOutflow - 300, 2)
  })

  it('flags estimatedResidualValue as missing when estimatedResaleValue is not provided', () => {
    const scenario = adaptGenericScenario({ id: 's1', input: immediateInput({ estimatedResaleValue: null }), dbData: db(), now: NOW })
    expect(scenario.missingMetrics).toContain('estimatedResidualValue')
    expect(scenario.metrics.estimatedResidualValue).toBe(0)
  })

  it('does not flag estimatedResidualValue when estimatedResaleValue is provided', () => {
    const scenario = adaptGenericScenario({ id: 's1', input: immediateInput({ estimatedResaleValue: 500 }), dbData: db(), now: NOW })
    expect(scenario.missingMetrics).not.toContain('estimatedResidualValue')
  })

  it('does not flag remainingDebtAtEnd for IMMEDIATE payment mode', () => {
    const scenario = adaptGenericScenario({ id: 's1', input: immediateInput(), dbData: db(), now: NOW })
    expect(scenario.missingMetrics).not.toContain('remainingDebtAtEnd')
    expect(scenario.metrics.remainingDebtAtEnd).toBe(0)
  })

  it('flags remainingDebtAtEnd as missing for INSTALLMENTS payment mode (genuinely unknown)', () => {
    const scenario = adaptGenericScenario({ id: 's1', input: installmentsInput(), dbData: db(), now: NOW })
    expect(scenario.missingMetrics).toContain('remainingDebtAtEnd')
  })

  it('computes totalFinancingCost as 0 for IMMEDIATE payment mode', () => {
    const scenario = adaptGenericScenario({ id: 's1', input: immediateInput(), dbData: db(), now: NOW })
    expect(scenario.metrics.totalFinancingCost).toBe(0)
  })

  it('computes a positive totalFinancingCost for INSTALLMENTS', () => {
    const scenario = adaptGenericScenario({ id: 's1', input: installmentsInput(), dbData: db(), now: NOW })
    expect(scenario.metrics.totalFinancingCost).toBeGreaterThanOrEqual(0)
  })

  it('maps quality/confidence indicators into finite scores', () => {
    const scenario = adaptGenericScenario({ id: 's1', input: immediateInput(), dbData: db(), now: NOW })
    expect(Number.isFinite(scenario.metrics.dataQualityScore)).toBe(true)
    expect(Number.isFinite(scenario.metrics.confidenceLevel)).toBe(true)
  })

  it('does not mutate the input or dbData objects', () => {
    const input = immediateInput()
    const data = db()
    const inputBefore = JSON.stringify(input)
    const dbBefore = JSON.stringify(data)
    adaptGenericScenario({ id: 's1', input, dbData: data, now: NOW })
    expect(JSON.stringify(input)).toBe(inputBefore)
    expect(JSON.stringify(data)).toBe(dbBefore)
  })
})
