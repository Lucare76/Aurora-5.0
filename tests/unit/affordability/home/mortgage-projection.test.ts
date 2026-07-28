import { describe, expect, it } from 'vitest'
import { describeMortgage, computeMortgageTotalPaid } from '@/lib/affordability/home/mortgage'
import { buildHomeProjection } from '@/lib/affordability/home/projections'
import { buildOwnershipCostRows } from '@/lib/affordability/home/ownership-cost'
import { computeHomeCosts } from '@/lib/affordability/home/costs'
import { buildHomeComparison, buildMortgageComparison } from '@/lib/affordability/home/comparison'
import type { HomeInput } from '@/lib/affordability/home/types'
import type { AffordabilityBaseline, AffordabilityInput } from '@/lib/affordability/types'
import type { CostBreakdown } from '@/lib/affordability/metrics'

function home(overrides: Partial<HomeInput> = {}): HomeInput {
  return {
    simulationName: 'Casa',
    condition: 'used',
    purpose: 'primary_home',
    askingPrice: 200000,
    agreedPrice: 200000,
    purchaseDate: '2026-09-01',
    currency: 'EUR',
    ownershipYears: 20,
    paymentMode: 'MORTGAGE',
    downPayment: 40000,
    mortgageAmount: 160000,
    mortgageMonthlyPayment: 700,
    mortgageDurationMonths: 300,
    ...overrides,
  }
}

describe('home mortgage helpers', () => {
  it('describes immediate payment', () => {
    expect(describeMortgage(home({ paymentMode: 'IMMEDIATE', mortgageMonthlyPayment: null, mortgageDurationMonths: null }))[0]).toContain('Pagamento immediato')
  })

  it('describes fixed and variable mortgage with manual rates', () => {
    expect(describeMortgage(home({ mortgageRateType: 'fixed', tan: 3.2, taeg: 3.6 })).join(' ')).toContain('TAN')
    expect(describeMortgage(home({ mortgageRateType: 'variable' })).join(' ')).toContain('variabile')
    expect(describeMortgage(home()).join(' ')).toContain('non indicato')
  })

  it('computes total paid including fees', () => {
    expect(computeMortgageTotalPaid(home({
      mortgageFees: { balloonPayment: 5000, origination: 1000, appraisal: 300, mandatoryInsurance: 700, preAmortization: 400, installmentCollection: 2 },
    }))).toBe(258000)
  })

  it('returns zero for immediate payment and defaults missing mortgage fields to zero', () => {
    expect(computeMortgageTotalPaid(home({ paymentMode: 'IMMEDIATE', mortgageMonthlyPayment: null, mortgageDurationMonths: null }))).toBe(0)
    expect(computeMortgageTotalPaid(home({ downPayment: null, mortgageMonthlyPayment: null, mortgageDurationMonths: null, mortgageFees: null }))).toBe(0)
  })
})

describe('home projection and ownership helpers', () => {
  it('delegates projection to the generic projection engine', () => {
    const baseline: AffordabilityBaseline = {
      totalLiquidity: 50000,
      monthlyIncome: 3000,
      monthlyExpenses: 1800,
      monthlyMargin: 1200,
      monthlyLoanPayments: 0,
      monthlyGoalContributions: 0,
      coverageMonths: 27.78,
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
      purchaseName: 'Casa',
      totalPrice: 200000,
      paymentMode: 'INSTALLMENTS',
      purchaseDate: '2026-09-01',
      currency: 'EUR',
      downPayment: 40000,
      installmentAmount: 700,
      numberOfInstallments: 12,
      firstInstallmentDate: '2026-10-01',
      monthlyRecurringCost: 300,
      horizonMonths: 12,
    }
    const costs: CostBreakdown = {
      upfrontCost: 40000,
      monthlyInstallment: 700,
      balloonPayment: 0,
      totalInstallmentCost: 48400,
      recurringMonthlyCost: 300,
      effectiveMonthlyCost: 1000,
      totalCostEstimate: 52000,
    }
    expect(buildHomeProjection(baseline, input, costs, '2026-07-01').points).toHaveLength(12)
  })

  it('filters zero cost breakdown rows', () => {
    const rows = buildOwnershipCostRows(computeHomeCosts(home({ acquisitionCosts: { notary: 3000 } })))
    expect(rows.every((row) => row.amount > 0)).toBe(true)
    expect(rows.some((row) => row.label === 'Notaio e imposte')).toBe(true)
  })

  it('classifies direct comparisons across affordable, risky and not affordable paths', () => {
    const baseCosts = computeHomeCosts(home({ askingPrice: 100000, agreedPrice: 100000, downPayment: 1000, mortgageAmount: 99000, mortgageMonthlyPayment: 100 }))
    const affordable = buildHomeComparison(
      home({
        askingPrice: 100000,
        agreedPrice: 100000,
        downPayment: 1000,
        mortgageAmount: 99000,
        mortgageMonthlyPayment: 100,
        compareWithHome: { label: 'Casa B', agreedPrice: 100000, downPayment: 1000, mortgageAmount: 99000, mortgageMonthlyPayment: 100 },
      }),
      baseCosts,
      500000,
      5000,
    )
    expect(affordable?.homeA.classification).toBe('AFFORDABLE')

    const risky = buildMortgageComparison(home({ compareMortgageOptions: [{ label: 'Rata alta', downPayment: 1000, mortgageAmount: 100000, monthlyPayment: 5000, durationMonths: 120 }] }), 50000, 3000)
    expect(risky?.options[0].classification).toBe('RISKY')

    const notAffordable = buildMortgageComparison(home({ compareMortgageOptions: [{ label: 'Anticipo impossibile', downPayment: 999999, mortgageAmount: 100000, monthlyPayment: 100, durationMonths: 120 }] }), 50000, 3000)
    expect(notAffordable?.options[0].classification).toBe('NOT_AFFORDABLE')
  })
})
