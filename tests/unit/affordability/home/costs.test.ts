import { describe, expect, it } from 'vitest'
import { computeHomeCosts } from '@/lib/affordability/home/costs'
import type { HomeInput } from '@/lib/affordability/home/types'

function makeInput(overrides: Partial<HomeInput> = {}): HomeInput {
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
    ...overrides,
  }
}

describe('computeHomeCosts', () => {
  it('computes effective price from contributions without subtracting deposit', () => {
    const costs = computeHomeCosts(makeInput({
      discount: 5000,
      familyContribution: 10000,
      manualBenefit: 2000,
      propertySaleProceeds: 3000,
      otherContribution: 1000,
      depositPaid: 15000,
    }))
    expect(costs.totalContributions).toBe(21000)
    expect(costs.effectivePropertyPrice).toBe(189000)
    expect(costs.depositPaid).toBe(15000)
  })

  it('computes mortgage totals, additional costs and upfront cost', () => {
    const costs = computeHomeCosts(makeInput({
      mortgageFees: {
        origination: 900,
        appraisal: 300,
        mandatoryInsurance: 1200,
        installmentCollection: 2,
        preAmortization: 400,
        balloonPayment: 5000,
      },
      acquisitionCosts: { notary: 3500, taxes: 2500, agency: 6000, moving: 1200 },
    }))
    expect(costs.mortgageTotalPayments).toBe(216000)
    expect(costs.mortgageAdditionalCost).toBe(8400)
    expect(costs.mortgageTotalCost).toBe(54400)
    expect(costs.upfrontHomeCost).toBe(55600)
  })

  it('computes renovation contingency and furnishing deferrable', () => {
    const costs = computeHomeCosts(makeInput({
      renovation: { totalEstimated: 20000, unexpectedExtra: 3000, contingencyPercent: 10 },
      furnishing: { furniture: 5000, kitchen: 8000, appliances: 2500, deferrable: 4000 },
    }))
    expect(costs.renovationContingency).toBe(2300)
    expect(costs.renovationCost).toBe(25300)
    expect(costs.furnishingCost).toBe(15500)
    expect(costs.furnishingDeferrable).toBe(4000)
  })

  it('computes recurring housing costs and current housing increment', () => {
    const costs = computeHomeCosts(makeInput({
      condominium: { monthly: 120, reserveFund: 240 },
      utilities: { electricity: 80, gas: 70, water: 25, internet: 30, waste: 20 },
      insurance: { homeAnnual: 300, fireAnnual: 200 },
      recurringTaxes: { imuAnnual: 600, tariAnnual: 250 },
      maintenance: { ordinaryAnnual: 900, boilerAnnual: 120 },
      currentHousing: { type: 'rent', rentMonthly: 760 },
    }))
    expect(costs.condominiumAnnualCost).toBe(1680)
    expect(costs.utilitiesAnnualCost).toBe(2700)
    expect(costs.insuranceAnnualCost).toBe(500)
    expect(costs.recurringTaxesAnnualCost).toBe(850)
    expect(costs.maintenanceAnnualCost).toBe(1020)
    expect(costs.averageMonthlyHousingCost).toBeGreaterThan(720)
    expect(costs.incrementalMonthlyHousingCost).toBe(costs.averageMonthlyHousingCost - 760)
  })

  it('handles immediate payment and residual net equity', () => {
    const costs = computeHomeCosts(makeInput({
      paymentMode: 'IMMEDIATE',
      cashPaymentAmount: 190000,
      downPayment: null,
      mortgageAmount: null,
      mortgageDurationMonths: null,
      mortgageMonthlyPayment: null,
      residualValue: { estimatedPropertyValue: 230000, residualMortgageDebt: 0, sellingCosts: 5000 },
    }))
    expect(costs.mortgageAmount).toBe(0)
    expect(costs.upfrontHomeCost).toBe(190000)
    expect(costs.estimatedNetEquity).toBe(225000)
    expect(costs.netOwnershipCost).toBe(0)
  })

  it('amortizes recurring tax exemption and maintenance events', () => {
    const costs = computeHomeCosts(makeInput({
      recurringTaxes: { imuAnnual: 1200, tariAnnual: 240, exempt: true, exemptionYears: 10 },
      maintenance: {
        ordinaryAnnual: 600,
        extraordinaryEstimated: 10000,
        roofEvent: { amount: 12000, months: 120 },
        facadeEvent: { amount: 6000 },
      },
    }))
    expect(costs.recurringTaxesAnnualCost).toBe(720)
    expect(costs.maintenanceAnnualCost).toBe(8300)
  })

  it('handles monthly renovation and furnishing installments', () => {
    const costs = computeHomeCosts(makeInput({
      renovation: { totalEstimated: 12000, alreadyPaid: 2000, paymentMode: 'monthly', immediatePayment: 1000, monthlyPayment: 500, numberOfInstallments: 20 },
      furnishing: { furniture: 6000, monthlyInstallment: 250, numberOfInstallments: 12 },
    }))
    expect(costs.renovationCost).toBe(12000)
    expect(costs.upfrontHomeCost).toBe(44000)
    expect(costs.averageMonthlyHousingCost).toBe(1470)
  })

  it('uses derived mortgage amount and caps deposit at agreed price', () => {
    const costs = computeHomeCosts(makeInput({
      mortgageAmount: null,
      downPayment: 50000,
      depositPaid: 999999,
    }))
    expect(costs.mortgageAmount).toBe(160000)
    expect(costs.depositPaid).toBe(210000)
  })

  it('reports missing costs without inventing estimates', () => {
    const costs = computeHomeCosts(makeInput())
    expect(costs.missingCosts).toEqual(expect.arrayContaining([
      'notaio',
      'imposte iniziali',
      'utenze',
      'manutenzione',
      'valore residuo stimato',
      'debito residuo stimato',
    ]))
  })
})
