import { describe, expect, it } from 'vitest'
import { computeTravelCosts } from '@/lib/affordability/travel/costs'
import { buildTravelProjection } from '@/lib/affordability/travel/projections'
import { daysInclusive, monthsUntil, nightsBetween, normalizeTravelPayments } from '@/lib/affordability/travel/schedule'
import type { AffordabilityBaseline, AffordabilityInput } from '@/lib/affordability/types'
import type { CostBreakdown } from '@/lib/affordability/metrics'
import type { TravelInput } from '@/lib/affordability/travel/types'

const NOW = new Date('2026-07-01T00:00:00Z')

function travel(overrides: Partial<TravelInput> = {}): TravelInput {
  return {
    simulationName: 'Vacanza',
    destination: 'Roma',
    country: 'Italia',
    currency: 'EUR',
    travelers: 2,
    adults: 2,
    children: 0,
    bookingDate: '2026-07-01',
    departureDate: '2026-10-01',
    returnDate: '2026-10-07',
    transportMode: 'train',
    lodgingType: 'hotel',
    transport: { mainTrip: 400, taxi: 80 },
    lodging: { totalCost: 900, deposit: 200, balance: 700, cleaning: 50, touristTax: 42 },
    meals: { mode: 'daily_budget', dailyBudgetPerPerson: 35 },
    activities: { museums: 100, excursions: 250 },
    extras: { shopping: 120, travelInsurance: 60, contingency: 150 },
    ...overrides,
  }
}

describe('travel schedule and costs', () => {
  it('computes duration and nights', () => {
    expect(daysInclusive('2026-10-01', '2026-10-07')).toBe(7)
    expect(nightsBetween('2026-10-01', '2026-10-07')).toBe(6)
  })

  it('computes transport, lodging, meals, activities, extra and total', () => {
    const costs = computeTravelCosts(travel(), NOW)
    expect(costs.transportTotal).toBe(480)
    expect(costs.lodgingTotal).toBe(992)
    expect(costs.mealsTotal).toBe(490)
    expect(costs.activitiesTotal).toBe(350)
    expect(costs.extrasTotal).toBe(330)
    expect(costs.totalTripCost).toBe(2642)
  })

  it('supports meals as total cost', () => {
    expect(computeTravelCosts(travel({ meals: { mode: 'total', totalCost: 800 } }), NOW).mealsTotal).toBe(800)
  })

  it('normalizes explicit payments and derives defaults otherwise', () => {
    const explicit = normalizeTravelPayments(travel({ payments: [{ label: 'Saldo', amount: 1000.129, date: '2026-09-01' }] }), 1000)
    expect(explicit[0].amount).toBe(1000.13)
    const derived = computeTravelCosts(travel(), NOW).payments
    expect(derived.map((payment) => payment.label)).toEqual(['Acconto', 'Saldo alloggio', 'Spese durante il viaggio'])
  })

  it('computes suggested monthly saving and missing costs', () => {
    const costs = computeTravelCosts(travel({ currentMonthlySaving: 100 }), NOW)
    expect(monthsUntil(NOW, '2026-10-01')).toBe(3)
    expect(costs.suggestedMonthlySaving).toBe(780.67)
    expect(computeTravelCosts(travel({ transport: null, lodging: null, meals: null, activities: null, extras: null }), NOW).missingCosts).toEqual(expect.arrayContaining(['trasporti', 'alloggio', 'pasti', 'attività', 'extra e imprevisti']))
  })

  it('builds travel projection via generic projection engine', () => {
    const baseline: AffordabilityBaseline = {
      totalLiquidity: 5000,
      monthlyIncome: 3000,
      monthlyExpenses: 1500,
      monthlyMargin: 1500,
      monthlyLoanPayments: 0,
      monthlyGoalContributions: 0,
      coverageMonths: 3.33,
      existingMonthlyDebtBurden: 0,
      dataQuality: 'ALTA',
      dataQualityScore: 90,
      historicMonthsAvailable: 6,
      incomeSource: 'TRANSACTIONS',
      expenseSource: 'TRANSACTIONS',
      hasActiveRecurring: false,
      hasLoans: false,
      warnings: [],
    }
    const input: AffordabilityInput = {
      purchaseName: 'Vacanza',
      totalPrice: 1200,
      paymentMode: 'IMMEDIATE',
      purchaseDate: '2026-08-01',
      currency: 'EUR',
      horizonMonths: 6,
    }
    const costs: CostBreakdown = {
      upfrontCost: 1200,
      monthlyInstallment: 0,
      balloonPayment: 0,
      totalInstallmentCost: 0,
      recurringMonthlyCost: 0,
      effectiveMonthlyCost: 0,
      totalCostEstimate: 1200,
    }
    expect(buildTravelProjection(baseline, input, costs, '2026-07-01').points).toHaveLength(6)
  })
})
