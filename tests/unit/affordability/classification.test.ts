import { describe, it, expect } from 'vitest'
import { classify, computeSustainabilityScore, classificationLabel } from '@/lib/affordability/classification'
import type { ClassificationInput } from '@/lib/affordability/classification'
import type { AffordabilityBaseline } from '@/lib/affordability/types'
import type { CostBreakdown, ProjectionResult } from '@/lib/affordability/metrics'

function makeBaseline(overrides: Partial<AffordabilityBaseline> = {}): AffordabilityBaseline {
  return {
    totalLiquidity: 10000,
    monthlyIncome: 3000,
    monthlyExpenses: 2000,
    monthlyMargin: 1000,
    monthlyLoanPayments: 0,
    monthlyGoalContributions: 0,
    coverageMonths: 5,
    existingMonthlyDebtBurden: 0,
    dataQuality: 'ALTA',
    dataQualityScore: 90,
    historicMonthsAvailable: 6,
    incomeSource: 'TRANSACTIONS',
    expenseSource: 'TRANSACTIONS',
    hasActiveRecurring: false,
    hasLoans: false,
    warnings: [],
    ...overrides,
  }
}

function makeCosts(overrides: Partial<CostBreakdown> = {}): CostBreakdown {
  return {
    upfrontCost: 2000,
    monthlyInstallment: 0,
    balloonPayment: 0,
    totalInstallmentCost: 0,
    recurringMonthlyCost: 0,
    effectiveMonthlyCost: 0,
    totalCostEstimate: 2000,
    ...overrides,
  }
}

function makeProjection(overrides: Partial<ProjectionResult> = {}): ProjectionResult {
  return {
    points: [],
    negativeMonths: 0,
    criticalMonths: [],
    minimumLiquidity: 8000,
    minimumLiquidityDate: null,
    ...overrides,
  }
}

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    purchaseName: 'Test',
    totalPrice: 2000,
    paymentMode: 'IMMEDIATE' as const,
    purchaseDate: '2026-08-01',
    currency: 'EUR',
    ...overrides,
  }
}

function makeParams(overrides: Partial<ClassificationInput> = {}): ClassificationInput {
  return {
    baseline: makeBaseline(),
    input: makeInput(),
    costs: makeCosts(),
    liquidityAfter: 8000,
    coverageMonthsAfter: 4,
    marginAfter: 1000,
    installmentToMarginRatio: null,
    projection: makeProjection(),
    ...overrides,
  }
}

describe('classify', () => {
  it('returns AFFORDABLE when all indicators are good', () => {
    const result = classify(makeParams())
    expect(result).toBe('AFFORDABLE')
  })

  it('returns NOT_AFFORDABLE when liquidityAfter is negative', () => {
    const result = classify(makeParams({ liquidityAfter: -100 }))
    expect(result).toBe('NOT_AFFORDABLE')
  })

  it('returns NOT_AFFORDABLE when negative months >= 6', () => {
    const result = classify(makeParams({
      projection: makeProjection({ negativeMonths: 6 }),
    }))
    expect(result).toBe('NOT_AFFORDABLE')
  })

  it('returns NOT_AFFORDABLE when margin deeply negative', () => {
    const result = classify(makeParams({
      marginAfter: -300,  // > 10% of monthlyExpenses (2000)
      costs: makeCosts({ effectiveMonthlyCost: 500 }),
    }))
    expect(result).toBe('NOT_AFFORDABLE')
  })

  it('returns RISKY when liquidity below half of minimum buffer', () => {
    // minMonths = 3, monthlyExpenses = 2000, minBuffer = 6000, half = 3000
    const result = classify(makeParams({ liquidityAfter: 2500 }))
    expect(result).toBe('RISKY')
  })

  it('returns RISKY when installment ratio > 0.70', () => {
    const result = classify(makeParams({
      installmentToMarginRatio: 0.75,
      input: makeInput({ paymentMode: 'INSTALLMENTS', installmentAmount: 750, numberOfInstallments: 12 }),
    }))
    expect(result).toBe('RISKY')
  })

  it('returns RISKY when negative months >= 3', () => {
    const result = classify(makeParams({
      projection: makeProjection({ negativeMonths: 3 }),
    }))
    expect(result).toBe('RISKY')
  })

  it('returns CAUTION when liquidity below min buffer (3 months)', () => {
    // minMonths = 3, monthlyExpenses = 2000, minBuffer = 6000
    const result = classify(makeParams({ liquidityAfter: 5000 }))
    expect(result).toBe('CAUTION')
  })

  it('returns CAUTION when installment ratio > maxRatio (0.35 default)', () => {
    const result = classify(makeParams({
      liquidityAfter: 8000,
      installmentToMarginRatio: 0.40,
      input: makeInput({ paymentMode: 'INSTALLMENTS', installmentAmount: 400, numberOfInstallments: 12 }),
    }))
    expect(result).toBe('CAUTION')
  })

  it('returns CAUTION when negative months = 1', () => {
    const result = classify(makeParams({
      projection: makeProjection({ negativeMonths: 1 }),
    }))
    expect(result).toBe('CAUTION')
  })

  it('returns CAUTION when coverageMonthsAfter < minMonths', () => {
    // Default minMonths = 3
    const result = classify(makeParams({ coverageMonthsAfter: 2 }))
    expect(result).toBe('CAUTION')
  })

  it('returns CAUTION when marginAfter < 0 (mild)', () => {
    // marginAfter < 0 but > -10% of monthlyExpenses means CAUTION not NOT_AFFORDABLE
    const result = classify(makeParams({
      marginAfter: -100, // < 0 but -100 < 10% of 2000=200
      costs: makeCosts({ effectiveMonthlyCost: 100 }),
    }))
    expect(result).toBe('CAUTION')
  })

  it('returns INSUFFICIENT_DATA when no accounts and no income', () => {
    const result = classify(makeParams({
      baseline: makeBaseline({
        dataQuality: 'INSUFFICIENTE',
        totalLiquidity: 0,
        monthlyIncome: 0,
        dataQualityScore: 0,
      }),
    }))
    expect(result).toBe('INSUFFICIENT_DATA')
  })

  it('still classifies with INSUFFICIENTE quality if there is some liquidity', () => {
    // Has liquidity but INSUFFICIENTE quality → should still classify
    const result = classify(makeParams({
      baseline: makeBaseline({
        dataQuality: 'INSUFFICIENTE',
        totalLiquidity: 5000,
        monthlyIncome: 0,
        dataQualityScore: 5,
      }),
      liquidityAfter: 3000,
      marginAfter: 0,
      coverageMonthsAfter: null,
    }))
    // Not INSUFFICIENT_DATA since totalLiquidity > 0
    expect(result).not.toBe('INSUFFICIENT_DATA')
  })

  it('respects custom minimumLiquidityMonths preference', () => {
    // With minMonths=1, minBuffer=2000; liquidityAfter=1500 → below minBuffer → CAUTION
    const result = classify(makeParams({
      liquidityAfter: 1500,
      coverageMonthsAfter: 0.75,
      input: makeInput({ minimumLiquidityMonths: 1 }),
    }))
    expect(result).toBe('CAUTION')
  })

  it('respects custom maxInstallmentToMarginRatio preference', () => {
    // With maxRatio=0.50, ratio=0.45 → should be AFFORDABLE (not CAUTION)
    const result = classify(makeParams({
      installmentToMarginRatio: 0.45,
      input: makeInput({
        paymentMode: 'INSTALLMENTS',
        maxInstallmentToMarginRatio: 0.50,
        installmentAmount: 450,
        numberOfInstallments: 12,
      }),
    }))
    expect(result).toBe('AFFORDABLE')
  })
})

describe('classificationLabel', () => {
  it('maps all classifications to Italian labels', () => {
    expect(classificationLabel('AFFORDABLE')).toBe('Sostenibile')
    expect(classificationLabel('CAUTION')).toBe('Sostenibile con cautela')
    expect(classificationLabel('RISKY')).toBe('Rischioso')
    expect(classificationLabel('NOT_AFFORDABLE')).toBe('Non sostenibile')
    expect(classificationLabel('INSUFFICIENT_DATA')).toBe('Dati insufficienti')
  })
})

describe('computeSustainabilityScore', () => {
  it('returns 100 for a perfect scenario', () => {
    const score = computeSustainabilityScore(makeParams({
      liquidityAfter: 10000,
      coverageMonthsAfter: 10,
      marginAfter: 1000,
      installmentToMarginRatio: null,
      projection: makeProjection({ negativeMonths: 0, minimumLiquidity: 10000 }),
    }))
    expect(score).toBe(100)
  })

  it('deducts points for negative liquidityAfter', () => {
    const perfect = computeSustainabilityScore(makeParams({ liquidityAfter: 10000 }))
    const negative = computeSustainabilityScore(makeParams({ liquidityAfter: -500 }))
    expect(negative).toBeLessThan(perfect)
    expect(perfect - negative).toBeGreaterThanOrEqual(40)
  })

  it('deducts points for negative margin', () => {
    const score = computeSustainabilityScore(makeParams({ marginAfter: -100 }))
    expect(score).toBeLessThan(100)
  })

  it('deducts points for negative projection months', () => {
    const score0 = computeSustainabilityScore(makeParams({ projection: makeProjection({ negativeMonths: 0 }) }))
    const score3 = computeSustainabilityScore(makeParams({ projection: makeProjection({ negativeMonths: 3 }) }))
    expect(score3).toBeLessThan(score0)
  })

  it('deducts points for high installment ratio', () => {
    const score = computeSustainabilityScore(makeParams({
      installmentToMarginRatio: 0.80,
    }))
    expect(score).toBeLessThan(100)
  })

  it('applies INSUFFICIENTE data quality penalty', () => {
    const good = computeSustainabilityScore(makeParams({
      baseline: makeBaseline({ dataQuality: 'ALTA' }),
    }))
    const bad = computeSustainabilityScore(makeParams({
      baseline: makeBaseline({ dataQuality: 'INSUFFICIENTE' }),
    }))
    expect(bad).toBeLessThan(good)
    expect(good - bad).toBeGreaterThanOrEqual(20)
  })

  it('returns 0 as minimum (never negative)', () => {
    const score = computeSustainabilityScore(makeParams({
      liquidityAfter: -5000,
      coverageMonthsAfter: -5,
      marginAfter: -2000,
      installmentToMarginRatio: 2,
      projection: makeProjection({ negativeMonths: 12, minimumLiquidity: -5000 }),
      baseline: makeBaseline({ dataQuality: 'INSUFFICIENTE' }),
    }))
    expect(score).toBeGreaterThanOrEqual(0)
  })

  it('returns maximum 100', () => {
    const score = computeSustainabilityScore(makeParams())
    expect(score).toBeLessThanOrEqual(100)
  })
})
