import { describe, expect, it } from 'vitest'
import { adaptTravelScenario } from '@/lib/decision-comparison/adapters/travel-adapter'
import type { AffordabilityDbData } from '@/lib/affordability/types'
import type { TravelInput } from '@/lib/affordability/travel/types'
import type { Account } from '@/types/database'

const NOW = new Date('2026-07-01T00:00:00Z')

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'a1', user_id: 'u1', name: 'Conto', type: 'checking', balance: 10000, currency: 'EUR',
    is_active: true, is_hidden: false, color: null, icon: null, sort_order: 0,
    created_at: '2026-01-01', updated_at: '2026-01-01', ...overrides,
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
    ],
    loans: [], loanPayments: [], goals: [], goalContributions: [],
    ...overrides,
  }
}

function travel(overrides: Partial<TravelInput> = {}): TravelInput {
  return {
    simulationName: 'Vacanza',
    currency: 'EUR',
    travelers: 2,
    adults: 2,
    children: 0,
    bookingDate: '2026-07-01',
    departureDate: '2026-10-01',
    returnDate: '2026-10-07',
    transport: { mainTrip: 400 },
    lodging: { totalCost: 900 },
    meals: { mode: 'daily_budget', dailyBudgetPerPerson: 35 },
    activities: { excursions: 250 },
    extras: { contingency: 150 },
    ...overrides,
  }
}

describe('adaptTravelScenario', () => {
  it('produces a TRAVEL_PURCHASE normalized scenario', () => {
    const scenario = adaptTravelScenario({ id: 't1', input: travel(), dbData: db(), now: NOW })
    expect(scenario.type).toBe('TRAVEL_PURCHASE')
    expect(scenario.currency).toBe('EUR')
  })

  it('defaults the name to simulationName when not provided', () => {
    const scenario = adaptTravelScenario({ id: 't1', input: travel({ simulationName: 'Estate' }), dbData: db(), now: NOW })
    expect(scenario.name).toBe('Estate')
  })

  it('honors an explicit name override', () => {
    const scenario = adaptTravelScenario({ id: 't1', name: 'Viaggio A', input: travel(), dbData: db(), now: NOW })
    expect(scenario.name).toBe('Viaggio A')
  })

  it('sets estimatedResidualValue to a genuine zero, not flagged as missing (a trip has no resale value)', () => {
    const scenario = adaptTravelScenario({ id: 't1', input: travel(), dbData: db(), now: NOW })
    expect(scenario.metrics.estimatedResidualValue).toBe(0)
    expect(scenario.missingMetrics).not.toContain('estimatedResidualValue')
  })

  it('sets totalFinancingCost and remainingDebtAtEnd to genuine zero (trips are never financed)', () => {
    const scenario = adaptTravelScenario({ id: 't1', input: travel(), dbData: db(), now: NOW })
    expect(scenario.metrics.totalFinancingCost).toBe(0)
    expect(scenario.metrics.remainingDebtAtEnd).toBe(0)
    expect(scenario.missingMetrics).toEqual([])
  })

  it('computes netTotalCost equal to totalCashOutflow (residual value is zero)', () => {
    const scenario = adaptTravelScenario({ id: 't1', input: travel(), dbData: db(), now: NOW })
    expect(scenario.metrics.netTotalCost).toBeCloseTo(scenario.metrics.totalCashOutflow, 2)
  })

  it('does not mutate the input or dbData objects', () => {
    const input = travel()
    const data = db()
    const inputBefore = JSON.stringify(input)
    const dbBefore = JSON.stringify(data)
    adaptTravelScenario({ id: 't1', input, dbData: data, now: NOW })
    expect(JSON.stringify(input)).toBe(inputBefore)
    expect(JSON.stringify(data)).toBe(dbBefore)
  })
})
