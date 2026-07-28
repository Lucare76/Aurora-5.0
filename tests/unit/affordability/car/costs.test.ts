import { describe, it, expect } from 'vitest'
import { computeCarCosts } from '@/lib/affordability/car/costs'
import type { CarInput } from '@/lib/affordability/car/types'

// ── Minimal input factory ─────────────────────────────────────────────────────

function makeInput(overrides: Partial<CarInput> = {}): CarInput {
  return {
    carName: 'Test Car',
    purchasePrice: 20000,
    paymentMode: 'IMMEDIATE',
    purchaseDate: '2026-08-01',
    currency: 'EUR',
    ownershipYears: 5,
    ...overrides,
  }
}

// ── Basic tests ───────────────────────────────────────────────────────────────

describe('computeCarCosts — IMMEDIATE', () => {
  it('no optional costs → upfrontCarCost = purchasePrice', () => {
    const costs = computeCarCosts(makeInput())
    expect(costs.upfrontCarCost).toBe(20000)
    expect(costs.effectivePurchasePrice).toBe(20000)
    expect(costs.totalReductions).toBe(0)
    expect(costs.monthlyInstallment).toBe(0)
    expect(costs.financingTotalCost).toBe(0)
    expect(costs.totalMonthlyRunningCost).toBe(0)
  })

  it('applies reductions correctly', () => {
    const costs = computeCarCosts(makeInput({
      purchasePrice: 25000,
      discount: 2000,
      incentive: 3000,
      tradeInValue: 5000,
    }))
    expect(costs.totalReductions).toBe(10000)
    expect(costs.effectivePurchasePrice).toBe(15000)
    expect(costs.upfrontCarCost).toBe(15000)
  })

  it('reductions cannot produce negative effectivePurchasePrice', () => {
    const costs = computeCarCosts(makeInput({
      purchasePrice: 5000,
      discount: 8000,
    }))
    expect(costs.effectivePurchasePrice).toBe(0)
  })

  it('adds initialCosts to upfront', () => {
    const costs = computeCarCosts(makeInput({
      initialCosts: { registration: 300, delivery: 200, other: 100 },
    }))
    expect(costs.initialCostsSum).toBe(600)
    expect(costs.upfrontCarCost).toBe(20600)
  })

  it('computes TCO correctly', () => {
    const costs = computeCarCosts(makeInput({
      purchasePrice: 20000,
      insurance: { rcAnnual: 1200 },
      tax: { bolloAnnual: 240 },
      fuel: { mode: 'monthly_estimate', monthlyEstimate: 100 },
      ownershipYears: 5,
    }))
    // 1200 + 240 = 1440/year running (insurance+tax), plus 1200 energy
    expect(costs.insuranceAnnualCost).toBe(1200)
    expect(costs.taxAnnualCost).toBe(240)
    expect(costs.energyAnnualCost).toBe(1200)
    expect(costs.totalAnnualRunningCost).toBe(2640)
    expect(costs.totalOwnershipCost).toBe(20000 + 2640 * 5)
  })

  it('subtracts residual value for netOwnershipCost', () => {
    const costs = computeCarCosts(makeInput({
      purchasePrice: 20000,
      estimatedResidualValue: 8000,
    }))
    expect(costs.residualValue).toBe(8000)
    expect(costs.netOwnershipCost).toBe(12000)
    expect(costs.averageMonthlyOwnershipCost).toBe(Math.round((12000 / 60) * 100) / 100)
  })

  it('computes costPerKilometer when annualKm provided', () => {
    const costs = computeCarCosts(makeInput({
      purchasePrice: 20000,
      annualKm: 15000,
      ownershipYears: 5,
    }))
    expect(costs.costPerKilometer).toBeTypeOf('number')
    expect(costs.costPerKilometer!).toBeGreaterThan(0)
    const expected = 20000 / (15000 * 5)
    expect(costs.costPerKilometer!).toBeCloseTo(expected, 2)
  })

  it('costPerKilometer is null when annualKm not provided', () => {
    const costs = computeCarCosts(makeInput())
    expect(costs.costPerKilometer).toBeNull()
  })
})

describe('computeCarCosts — FINANCING', () => {
  it('computes financing costs correctly', () => {
    const costs = computeCarCosts(makeInput({
      paymentMode: 'FINANCING',
      purchasePrice: 20000,
      downPayment: 5000,
      installmentAmount: 300,
      numberOfInstallments: 60,
      financingFees: 500,
    }))
    expect(costs.upfrontCarCost).toBe(5500) // downPayment + financingFees + initialCostsSum(0)
    expect(costs.financedAmount).toBe(15000) // effectivePurchasePrice - downPayment
    expect(costs.monthlyInstallment).toBe(300)
    expect(costs.numberOfInstallments).toBe(60)
    // financingTotalCost = (5000 + 300*60 + 0 + 500) - 20000 = 23500 - 20000 = 3500
    expect(costs.financingTotalCost).toBe(3500)
  })

  it('TCO for FINANCING includes all installments', () => {
    const costs = computeCarCosts(makeInput({
      paymentMode: 'FINANCING',
      purchasePrice: 20000,
      downPayment: 5000,
      installmentAmount: 300,
      numberOfInstallments: 60,
      financingFees: 500,
      ownershipYears: 5,
    }))
    // totalOwnershipCost = downPayment + financingFees + initialCosts + installments + running
    // = 5000 + 500 + 0 + 300*60 + 0 = 23500
    expect(costs.totalOwnershipCost).toBe(23500)
  })

  it('includes balloon payment in TCO', () => {
    const costs = computeCarCosts(makeInput({
      paymentMode: 'FINANCING',
      purchasePrice: 20000,
      downPayment: 5000,
      installmentAmount: 200,
      numberOfInstallments: 36,
      balloonPayment: 5000,
      ownershipYears: 3,
    }))
    // totalPaid = 5000 + 200*36 + 5000 + 0 = 17200
    // financingTotalCost = 17200 - 20000 = -2800 → clamped to 0 (balloon + installments < price)
    expect(costs.financingTotalCost).toBeGreaterThanOrEqual(0)
  })
})

describe('computeCarCosts — running costs', () => {
  it('fuel via usage_calculation', () => {
    const costs = computeCarCosts(makeInput({
      annualKm: 15000,
      fuel: { mode: 'usage_calculation', consumptionPer100: 6, price: 1.8 },
    }))
    // 15000/100 * 6 * 1.8 = 1620
    expect(costs.energyAnnualCost).toBe(1620)
  })

  it('fuel via monthly_estimate', () => {
    const costs = computeCarCosts(makeInput({
      fuel: { mode: 'monthly_estimate', monthlyEstimate: 120 },
    }))
    expect(costs.energyAnnualCost).toBe(1440)
  })

  it('tax with exemption years', () => {
    const costs = computeCarCosts(makeInput({
      ownershipYears: 5,
      tax: { bolloAnnual: 240, exemptionYears: 3 },
    }))
    // taxable years = 5 - 3 = 2; average = 240 * 2 / 5 = 96
    expect(costs.taxAnnualCost).toBe(96)
  })

  it('tax with full exemption', () => {
    const costs = computeCarCosts(makeInput({
      tax: { bolloAnnual: 240, exempt: true },
    }))
    expect(costs.taxAnnualCost).toBe(0)
  })

  it('maintenance with amortized revision', () => {
    const costs = computeCarCosts(makeInput({
      maintenance: {
        ordinaryAnnual: 200,
        revisionCost: 80,
        revisionIntervalMonths: 24,
      },
    }))
    // revision: 80 / (24/12) = 80 / 2 = 40/year
    expect(costs.maintenanceAnnualCost).toBe(240) // 200 + 40
  })

  it('currentCar monthly cost computed', () => {
    const costs = computeCarCosts(makeInput({
      currentCar: {
        monthlyInstallment: 200,
        insuranceMonthly: 80,
        bolloAnnual: 240,
        fuelMonthly: 100,
      },
    }))
    // 200 + 80 + 240/12 + 100 = 200 + 80 + 20 + 100 = 400
    expect(costs.currentCarMonthlyCost).toBe(400)
  })
})

describe('computeCarCosts — missingCosts', () => {
  it('reports missing insurance and fuel when not provided', () => {
    const costs = computeCarCosts(makeInput())
    expect(costs.missingCosts).toContain('assicurazione')
    expect(costs.missingCosts).toContain('carburante/energia')
    expect(costs.missingCosts).toContain('bollo auto')
    expect(costs.missingCosts).toContain('manutenzione ordinaria')
  })

  it('no missing when all provided', () => {
    const costs = computeCarCosts(makeInput({
      insurance: { rcAnnual: 800 },
      tax: { bolloAnnual: 200 },
      fuel: { mode: 'monthly_estimate', monthlyEstimate: 100 },
      maintenance: { ordinaryAnnual: 300 },
    }))
    expect(costs.missingCosts).toHaveLength(0)
  })

  it('exempt from bollo → bollo not reported missing', () => {
    const costs = computeCarCosts(makeInput({
      insurance: { rcAnnual: 800 },
      tax: { exempt: true },
      fuel: { mode: 'monthly_estimate', monthlyEstimate: 100 },
      maintenance: { ordinaryAnnual: 300 },
    }))
    expect(costs.missingCosts).not.toContain('bollo auto')
  })
})
