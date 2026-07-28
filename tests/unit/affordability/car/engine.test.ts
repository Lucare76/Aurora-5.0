import { describe, it, expect } from 'vitest'
import { runCarAffordabilityEngine } from '@/lib/affordability/car/engine'
import type { CarInput } from '@/lib/affordability/car/types'
import type { AffordabilityDbData } from '@/lib/affordability/types'
import type { Account } from '@/types/database'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-07-01T00:00:00Z')

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-1',
    user_id: 'user-1',
    name: 'Conto corrente',
    type: 'checking',
    color: null,
    icon: null,
    balance: 30000,
    currency: 'EUR',
    is_active: true,
    is_hidden: false,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeDbData(overrides: Partial<AffordabilityDbData> = {}): AffordabilityDbData {
  return {
    accounts: [makeAccount()],
    recurringRules: [
      {
        id: 'rule-1',
        type: 'income',
        amount: 3000,
        frequency: 'monthly',
        start_date: '2025-01-01',
        end_date: null,
        next_due_date: '2026-07-01',
        is_active: true,
      },
      {
        id: 'rule-2',
        type: 'expense',
        amount: 1500,
        frequency: 'monthly',
        start_date: '2025-01-01',
        end_date: null,
        next_due_date: '2026-07-01',
        is_active: true,
      },
    ],
    recentTransactions: [
      { id: 'tx-1', type: 'income', amount: 3000, date: '2026-06-15', transfer_peer_id: null },
      { id: 'tx-2', type: 'expense', amount: 1500, date: '2026-06-15', transfer_peer_id: null },
      { id: 'tx-3', type: 'income', amount: 3000, date: '2026-05-15', transfer_peer_id: null },
      { id: 'tx-4', type: 'expense', amount: 1500, date: '2026-05-15', transfer_peer_id: null },
      { id: 'tx-5', type: 'income', amount: 3000, date: '2026-04-15', transfer_peer_id: null },
      { id: 'tx-6', type: 'expense', amount: 1500, date: '2026-04-15', transfer_peer_id: null },
    ],
    loans: [],
    loanPayments: [],
    goals: [],
    goalContributions: [],
    ...overrides,
  }
}

function makeCarInput(overrides: Partial<CarInput> = {}): CarInput {
  return {
    carName: 'Toyota Yaris Hybrid',
    purchasePrice: 25000,
    paymentMode: 'IMMEDIATE',
    purchaseDate: '2026-07-01',
    currency: 'EUR',
    ownershipYears: 5,
    annualKm: 15000,
    insurance: { rcAnnual: 800 },
    tax: { bolloAnnual: 200 },
    fuel: { mode: 'monthly_estimate', monthlyEstimate: 100 },
    maintenance: { ordinaryAnnual: 300 },
    estimatedResidualValue: 8000,
    ...overrides,
  }
}

// ── Engine result shape ────────────────────────────────────────────────────────

describe('runCarAffordabilityEngine — result shape', () => {
  it('returns a valid CarAffordabilityResult', () => {
    const result = runCarAffordabilityEngine(makeCarInput(), makeDbData(), NOW)

    expect(result.classification).toBeTypeOf('string')
    expect(result.classificationLabel).toBeTypeOf('string')
    expect(result.currency).toBe('EUR')
    expect(result.carMetrics).toBeDefined()
    expect(result.reasons).toBeInstanceOf(Array)
    expect(result.risks).toBeInstanceOf(Array)
    expect(result.alternatives).toBeInstanceOf(Array)
    expect(result.projections).toBeInstanceOf(Array)
  })

  it('carMetrics contains expected fields', () => {
    const result = runCarAffordabilityEngine(makeCarInput(), makeDbData(), NOW)
    const m = result.carMetrics

    expect(m.carPurchasePrice).toBe(25000)
    expect(m.effectivePurchasePrice).toBe(25000)
    expect(m.totalReductions).toBe(0)
    expect(m.totalAnnualRunningCost).toBeGreaterThan(0)
    expect(m.averageMonthlyOwnershipCost).toBeGreaterThan(0)
    expect(m.ownershipPeriodMonths).toBe(60)
    expect(m.residualValue).toBe(8000)
    expect(m.netOwnershipCost).toBeLessThan(m.totalOwnershipCost)
  })

  it('computes costPerKilometer when annualKm provided', () => {
    const result = runCarAffordabilityEngine(makeCarInput(), makeDbData(), NOW)
    expect(result.carMetrics.costPerKilometer).not.toBeNull()
    expect(result.carMetrics.costPerKilometer!).toBeGreaterThan(0)
  })

  it('costPerKilometer is null without annualKm', () => {
    const result = runCarAffordabilityEngine(makeCarInput({ annualKm: null }), makeDbData(), NOW)
    expect(result.carMetrics.costPerKilometer).toBeNull()
  })
})

// ── No DB mutations ────────────────────────────────────────────────────────────

describe('runCarAffordabilityEngine — no mutations', () => {
  it('does not mutate dbData', () => {
    const dbData = makeDbData()
    const originalAccounts = JSON.stringify(dbData.accounts)
    runCarAffordabilityEngine(makeCarInput(), dbData, NOW)
    expect(JSON.stringify(dbData.accounts)).toBe(originalAccounts)
  })

  it('calculatedAt is set to NOW ISO string (approx)', () => {
    const result = runCarAffordabilityEngine(makeCarInput(), makeDbData(), NOW)
    expect(result.calculatedAt).toContain('2026-07-01')
  })
})

// ── Reductions ────────────────────────────────────────────────────────────────

describe('runCarAffordabilityEngine — reductions', () => {
  it('applies discount and incentive', () => {
    const result = runCarAffordabilityEngine(
      makeCarInput({ discount: 2000, incentive: 3000 }),
      makeDbData(),
      NOW,
    )
    expect(result.carMetrics.totalReductions).toBe(5000)
    expect(result.carMetrics.effectivePurchasePrice).toBe(20000)
  })
})

// ── Financing ─────────────────────────────────────────────────────────────────

describe('runCarAffordabilityEngine — FINANCING', () => {
  it('sets monthlyInstallment and paymentComparison', () => {
    // downPayment(5000) + installments(400*60=24000) + fees(500) = 29500 > purchasePrice(25000)
    const result = runCarAffordabilityEngine(
      makeCarInput({
        paymentMode: 'FINANCING',
        downPayment: 5000,
        installmentAmount: 400,
        numberOfInstallments: 60,
        financingFees: 500,
      }),
      makeDbData(),
      NOW,
    )
    expect(result.carMetrics.financingTotalCost).toBeGreaterThan(0)
    expect(result.paymentComparison).toBeInstanceOf(Array)
    expect(result.paymentComparison!.length).toBe(2)
    expect(result.paymentComparison!.map((p) => p.mode)).toContain('IMMEDIATE')
    expect(result.paymentComparison!.map((p) => p.mode)).toContain('FINANCING')
  })

  it('IMMEDIATE mode returns null paymentComparison', () => {
    const result = runCarAffordabilityEngine(makeCarInput(), makeDbData(), NOW)
    expect(result.paymentComparison).toBeNull()
  })
})

// ── Car comparison ────────────────────────────────────────────────────────────

describe('runCarAffordabilityEngine — car comparison', () => {
  it('returns null carComparison without compareWithCar', () => {
    const result = runCarAffordabilityEngine(makeCarInput(), makeDbData(), NOW)
    expect(result.carComparison).toBeNull()
  })

  it('returns CarComparisonResult with compareWithCar', () => {
    const result = runCarAffordabilityEngine(
      makeCarInput({
        compareWithCar: {
          carName: 'Fiat Panda',
          purchasePrice: 15000,
          paymentMode: 'IMMEDIATE',
          insuranceAnnualCost: 600,
          bolloAnnualCost: 150,
          fuelMonthlyCost: 80,
          maintenanceAnnualCost: 200,
        },
      }),
      makeDbData(),
      NOW,
    )
    expect(result.carComparison).not.toBeNull()
    expect(result.carComparison!.carA.label).toBe('Toyota Yaris Hybrid')
    expect(result.carComparison!.carB.label).toBe('Fiat Panda')
    expect(result.carComparison!.winner).toBeDefined()
  })
})

// ── Classification ────────────────────────────────────────────────────────────

describe('runCarAffordabilityEngine — classification', () => {
  it('affordable when car is within means', () => {
    // Balance 30k, margin 1500/mo, buying a 5k car
    const result = runCarAffordabilityEngine(
      makeCarInput({ purchasePrice: 5000, estimatedResidualValue: 0 }),
      makeDbData({ accounts: [makeAccount({ balance: 30000 })] }),
      NOW,
    )
    expect(['AFFORDABLE', 'CAUTION']).toContain(result.classification)
  })

  it('not affordable when car costs more than total liquidity', () => {
    const result = runCarAffordabilityEngine(
      makeCarInput({ purchasePrice: 35000, estimatedResidualValue: 0 }),
      makeDbData({ accounts: [makeAccount({ balance: 30000 })] }),
      NOW,
    )
    expect(['RISKY', 'NOT_AFFORDABLE', 'CAUTION']).toContain(result.classification)
  })

  it('insufficient_data without accounts or transactions', () => {
    const result = runCarAffordabilityEngine(
      makeCarInput(),
      makeDbData({ accounts: [], recurringRules: [], recentTransactions: [] }),
      NOW,
    )
    expect(result.classification).toBe('INSUFFICIENT_DATA')
  })
})

// ── Missing costs ─────────────────────────────────────────────────────────────

describe('runCarAffordabilityEngine — missing costs', () => {
  it('populates missingData with missing car costs', () => {
    const result = runCarAffordabilityEngine(
      makeCarInput({ insurance: null, tax: null, fuel: null, maintenance: null }),
      makeDbData(),
      NOW,
    )
    const hasMissingNote = result.missingData.some((d) => d.toLowerCase().includes('costi non indicati'))
    expect(hasMissingNote).toBe(true)
  })

  it('no missing data entry when all costs provided', () => {
    const result = runCarAffordabilityEngine(makeCarInput(), makeDbData(), NOW)
    const hasMissingNote = result.missingData.some((d) => d.toLowerCase().includes('costi non indicati'))
    expect(hasMissingNote).toBe(false)
  })
})
