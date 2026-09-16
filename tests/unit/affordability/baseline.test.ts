import { describe, expect, it } from 'vitest'
import { buildAffordabilityBaseline } from '@/lib/affordability/baseline'
import type { AffordabilityDbData } from '@/lib/affordability/types'

const now = new Date('2026-07-15T00:00:00Z')

function baseData(overrides: Partial<AffordabilityDbData> = {}): AffordabilityDbData {
  return {
    accounts: [{ id: 'acc-1', balance: 5000, is_active: true }],
    recentTransactions: [],
    recurringRules: [],
    loans: [],
    loanPayments: [],
    goals: [],
    goalContributions: [],
    ...overrides,
  } as AffordabilityDbData
}

describe('buildAffordabilityBaseline — neutral transactions excluded', () => {
  it('11. non conta un movimento neutro (expense) nella stima mensile delle uscite', () => {
    const withoutNeutral = buildAffordabilityBaseline(baseData({
      recentTransactions: [
        { id: 't1', type: 'expense', amount: 500, date: '2026-07-05', transfer_peer_id: null, is_neutral: false },
      ],
    }), false, now)

    const withNeutral = buildAffordabilityBaseline(baseData({
      recentTransactions: [
        { id: 't1', type: 'expense', amount: 500, date: '2026-07-05', transfer_peer_id: null, is_neutral: false },
        { id: 't2', type: 'expense', amount: 203.4, date: '2026-07-06', transfer_peer_id: null, is_neutral: true },
      ],
    }), false, now)

    expect(withNeutral.monthlyExpenses).toBe(withoutNeutral.monthlyExpenses)
  })

  it('11b. non conta un movimento neutro (income) nella stima mensile delle entrate', () => {
    const withoutNeutral = buildAffordabilityBaseline(baseData({
      recentTransactions: [
        { id: 't1', type: 'income', amount: 2000, date: '2026-07-05', transfer_peer_id: null, is_neutral: false },
      ],
    }), false, now)

    const withNeutral = buildAffordabilityBaseline(baseData({
      recentTransactions: [
        { id: 't1', type: 'income', amount: 2000, date: '2026-07-05', transfer_peer_id: null, is_neutral: false },
        { id: 't2', type: 'income', amount: 291.32, date: '2026-07-06', transfer_peer_id: null, is_neutral: true },
      ],
    }), false, now)

    expect(withNeutral.monthlyIncome).toBe(withoutNeutral.monthlyIncome)
  })
})
