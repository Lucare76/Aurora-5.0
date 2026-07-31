import { describe, expect, it } from 'vitest'
import { adaptHomeScenario } from '@/lib/decision-comparison/adapters/home-adapter'
import type { AffordabilityDbData } from '@/lib/affordability/types'
import type { HomeInput } from '@/lib/affordability/home/types'
import type { Account } from '@/types/database'

const NOW = new Date('2026-07-01T00:00:00Z')

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-1', user_id: 'user-1', name: 'Conto', type: 'checking', color: null, icon: null,
    balance: 80000, currency: 'EUR', is_active: true, is_hidden: false, sort_order: 0,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...overrides,
  }
}

function db(overrides: Partial<AffordabilityDbData> = {}): AffordabilityDbData {
  return {
    accounts: [account()],
    recurringRules: [
      { id: 'r1', type: 'income', amount: 3500, frequency: 'monthly', start_date: '2025-01-01', end_date: null, next_due_date: '2026-07-01', is_active: true },
      { id: 'r2', type: 'expense', amount: 1800, frequency: 'monthly', start_date: '2025-01-01', end_date: null, next_due_date: '2026-07-01', is_active: true },
    ],
    recentTransactions: [
      { id: 'i1', type: 'income', amount: 3500, date: '2026-06-10', transfer_peer_id: null },
      { id: 'e1', type: 'expense', amount: 1800, date: '2026-06-11', transfer_peer_id: null },
      { id: 'i2', type: 'income', amount: 3500, date: '2026-05-10', transfer_peer_id: null },
      { id: 'e2', type: 'expense', amount: 1800, date: '2026-05-11', transfer_peer_id: null },
    ],
    loans: [], loanPayments: [], goals: [], goalContributions: [],
    ...overrides,
  }
}

function home(overrides: Partial<HomeInput> = {}): HomeInput {
  return {
    simulationName: 'Casa test',
    condition: 'used',
    purpose: 'primary_home',
    askingPrice: 220000,
    agreedPrice: 210000,
    purchaseDate: '2026-09-01',
    currency: 'EUR',
    ownershipYears: 20,
    paymentMode: 'MORTGAGE',
    downPayment: 40000,
    mortgageAmount: 170000,
    mortgageDurationMonths: 300,
    mortgageMonthlyPayment: 720,
    acquisitionCosts: { notary: 3500, taxes: 2500, agency: 6000, moving: 1200 },
    condominium: { monthly: 120 },
    utilities: { electricity: 80, gas: 70, water: 25, internet: 30, waste: 20 },
    insurance: { homeAnnual: 300, fireAnnual: 200 },
    recurringTaxes: { imuAnnual: 600, tariAnnual: 250 },
    maintenance: { ordinaryAnnual: 900 },
    currentHousing: { type: 'rent', rentMonthly: 760 },
    residualValue: { estimatedPropertyValue: 230000, residualMortgageDebt: 120000, sellingCosts: 5000 },
    minimumLiquidityMonths: 6,
    horizonMonths: 360,
    ...overrides,
  }
}

describe('adaptHomeScenario', () => {
  it('produces a HOME_PURCHASE normalized scenario', () => {
    const scenario = adaptHomeScenario({ id: 'h1', input: home(), dbData: db(), now: NOW })
    expect(scenario.type).toBe('HOME_PURCHASE')
    expect(scenario.currency).toBe('EUR')
  })

  it('defaults the name to simulationName when not provided', () => {
    const scenario = adaptHomeScenario({ id: 'h1', input: home({ simulationName: 'Trilocale' }), dbData: db(), now: NOW })
    expect(scenario.name).toBe('Trilocale')
  })

  it('honors an explicit name override', () => {
    const scenario = adaptHomeScenario({ id: 'h1', name: 'Casa A', input: home(), dbData: db(), now: NOW })
    expect(scenario.name).toBe('Casa A')
  })

  it('never flags any metric as missing (the home engine tracks all of them)', () => {
    const scenario = adaptHomeScenario({ id: 'h1', input: home(), dbData: db(), now: NOW })
    expect(scenario.missingMetrics).toEqual([])
  })

  it('maps remainingDebtAtEnd from homeMetrics.residualMortgageDebt', () => {
    const scenario = adaptHomeScenario({ id: 'h1', input: home(), dbData: db(), now: NOW })
    expect(scenario.metrics.remainingDebtAtEnd).toBeGreaterThanOrEqual(0)
  })

  it('maps totalFinancingCost from homeMetrics.mortgageAdditionalCost', () => {
    const scenario = adaptHomeScenario({ id: 'h1', input: home(), dbData: db(), now: NOW })
    expect(scenario.metrics.totalFinancingCost).toBeGreaterThanOrEqual(0)
  })

  it('computes netTotalCost as totalCashOutflow minus residual property value', () => {
    const scenario = adaptHomeScenario({ id: 'h1', input: home(), dbData: db(), now: NOW })
    expect(scenario.metrics.netTotalCost).toBeCloseTo(
      scenario.metrics.totalCashOutflow - scenario.metrics.estimatedResidualValue,
      2,
    )
  })

  it('does not mutate the input or dbData objects', () => {
    const input = home()
    const data = db()
    const inputBefore = JSON.stringify(input)
    const dbBefore = JSON.stringify(data)
    adaptHomeScenario({ id: 'h1', input, dbData: data, now: NOW })
    expect(JSON.stringify(input)).toBe(inputBefore)
    expect(JSON.stringify(data)).toBe(dbBefore)
  })
})
