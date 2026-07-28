import { describe, expect, it } from 'vitest'
import { runTravelAffordabilityEngine } from '@/lib/affordability/travel/engine'
import type { TravelInput } from '@/lib/affordability/travel/types'
import type { AffordabilityDbData } from '@/lib/affordability/types'
import type { Account } from '@/types/database'

const NOW = new Date('2026-07-01T00:00:00Z')

function account(overrides: Partial<Account> = {}): Account {
  return { id: 'a1', user_id: 'u1', name: 'Conto', type: 'checking', balance: 10000, currency: 'EUR', is_active: true, is_hidden: false, color: null, icon: null, sort_order: 0, created_at: '2026-01-01', updated_at: '2026-01-01', ...overrides }
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

describe('runTravelAffordabilityEngine', () => {
  it('returns travel metrics and does not mutate data', () => {
    const data = db()
    const before = JSON.stringify(data)
    const result = runTravelAffordabilityEngine(travel(), data, NOW)
    expect(result.engineVersion).toBe('1.1.0-travel')
    expect(result.travelMetrics.totalTripCost).toBeGreaterThan(0)
    expect(result.travelMetrics.durationDays).toBe(7)
    expect(result.departureShiftComparison).toHaveLength(4)
    expect(JSON.stringify(data)).toBe(before)
  })

  it('generates alternatives, risks and max budget', () => {
    const result = runTravelAffordabilityEngine(travel({ extras: null }), db(), NOW)
    expect(result.alternatives.map((alt) => alt.type)).toEqual(expect.arrayContaining(['reduce_days', 'postpone', 'increase_saving']))
    expect(result.risks.some((risk) => risk.text.includes('Valutazione parziale'))).toBe(true)
    expect(result.maxAffordablePrice).toBeGreaterThan(0)
  })

  it('compares vacation A and B', () => {
    const result = runTravelAffordabilityEngine(travel({
      compareWithTravel: { label: 'Vacanza B', totalCost: 2000, departureDate: '2026-11-01', returnDate: '2026-11-05' },
    }), db(), NOW)
    expect(result.travelComparison).not.toBeNull()
    expect(result.travelComparison!.insight.lowerCost).toMatch(/A|B|equal/)
  })

  it('returns insufficient data without baseline', () => {
    const result = runTravelAffordabilityEngine(travel(), db({ accounts: [], recurringRules: [], recentTransactions: [] }), NOW)
    expect(result.classification).toBe('INSUFFICIENT_DATA')
  })
})
