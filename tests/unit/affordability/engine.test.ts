import { describe, it, expect } from 'vitest'
import { runAffordabilityEngine } from '@/lib/affordability/engine'
import type { AffordabilityInput, AffordabilityDbData } from '@/lib/affordability/types'
import type { Account, RecurringFrequency } from '@/types/database'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAccount(id: string, balance: number): Account {
  return {
    id,
    user_id: 'u1',
    name: 'Test',
    type: 'checking',
    color: null,
    icon: null,
    balance,
    currency: 'EUR',
    is_active: true,
    is_hidden: false,
    sort_order: 0,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  }
}

function makeTx(type: 'income' | 'expense', amount: number, date: string) {
  return { id: crypto.randomUUID(), type, amount, date, transfer_peer_id: null }
}

function makeRule(type: 'income' | 'expense', amount: number, frequency: RecurringFrequency) {
  return {
    id: crypto.randomUUID(),
    type,
    amount,
    frequency,
    start_date: '2025-01-01',
    end_date: null,
    next_due_date: '2025-02-01',
    is_active: true,
  }
}

function emptyDb(): AffordabilityDbData {
  return {
    accounts: [],
    recurringRules: [],
    recentTransactions: [],
    loans: [],
    loanPayments: [],
    goals: [],
    goalContributions: [],
  }
}

// Creates 3 months of transactions ending BEFORE NOW (July 1), so dates are June, May, April
function richDb(monthlyIncome = 3000, monthlyExpenses = 2000, balance = 10000): AffordabilityDbData {
  const txs = []
  // Use months 1, 2, 3 months BEFORE now so all fall within the lookback window
  const months = ['2026-06-15', '2026-05-15', '2026-04-15']
  for (const date of months) {
    txs.push(makeTx('income', monthlyIncome, date))
    txs.push(makeTx('expense', monthlyExpenses, date))
  }
  return {
    accounts: [makeAccount('acc1', balance)],
    recurringRules: [],
    recentTransactions: txs,
    loans: [],
    loanPayments: [],
    goals: [],
    goalContributions: [],
  }
}

function baseInput(overrides: Partial<AffordabilityInput> = {}): AffordabilityInput {
  return {
    purchaseName: 'Laptop',
    totalPrice: 1200,
    paymentMode: 'IMMEDIATE',
    purchaseDate: '2026-08-01',
    currency: 'EUR',
    ...overrides,
  }
}

const NOW = new Date('2026-07-01T12:00:00Z')

// ── No mutations guard ────────────────────────────────────────────────────────

describe('runAffordabilityEngine — no mutations', () => {
  it('does not modify the input object', () => {
    const input = baseInput()
    const frozen = Object.freeze({ ...input })
    const db = richDb()
    // Should not throw for frozen input (reads only)
    expect(() => runAffordabilityEngine({ ...frozen }, db, NOW)).not.toThrow()
  })

  it('does not modify the dbData object', () => {
    const db = richDb()
    const accountsBefore = JSON.stringify(db.accounts)
    runAffordabilityEngine(baseInput(), db, NOW)
    expect(JSON.stringify(db.accounts)).toBe(accountsBefore)
  })
})

// ── INSUFFICIENT_DATA ─────────────────────────────────────────────────────────

describe('runAffordabilityEngine — INSUFFICIENT_DATA', () => {
  it('returns INSUFFICIENT_DATA when no accounts', () => {
    const result = runAffordabilityEngine(baseInput(), emptyDb(), NOW)
    expect(result.classification).toBe('INSUFFICIENT_DATA')
  })

  it('includes engine metadata', () => {
    const result = runAffordabilityEngine(baseInput(), emptyDb(), NOW)
    expect(result.engineVersion).toBe('1.0.0')
    expect(result.calculatedAt).toBeTruthy()
    expect(result.disclaimer).toContain('Aurora')
  })

  it('currency is preserved from input', () => {
    const result = runAffordabilityEngine(baseInput({ currency: 'USD' }), emptyDb(), NOW)
    expect(result.currency).toBe('USD')
  })
})

// ── IMMEDIATE payment ─────────────────────────────────────────────────────────

describe('runAffordabilityEngine — immediate payment', () => {
  it('returns AFFORDABLE for a small purchase with good baseline', () => {
    const result = runAffordabilityEngine(
      baseInput({ totalPrice: 500 }),
      richDb(3000, 2000, 10000),
      NOW,
    )
    expect(result.classification).toBe('AFFORDABLE')
  })

  it('computes liquidityAfter correctly', () => {
    const result = runAffordabilityEngine(
      baseInput({ totalPrice: 1200 }),
      richDb(3000, 2000, 10000),
      NOW,
    )
    expect(result.liquidityAfter).toBeCloseTo(10000 - 1200, 1)
  })

  it('monthlyInstallment is zero for IMMEDIATE', () => {
    const result = runAffordabilityEngine(baseInput(), richDb(), NOW)
    expect(result.monthlyInstallment).toBe(0)
  })

  it('balloonPayment is zero for IMMEDIATE', () => {
    const result = runAffordabilityEngine(baseInput(), richDb(), NOW)
    expect(result.balloonPayment).toBe(0)
  })

  it('includes additionalUpfrontCosts in upfrontCost', () => {
    const result = runAffordabilityEngine(
      baseInput({ totalPrice: 1000, additionalUpfrontCosts: 200 }),
      richDb(3000, 2000, 10000),
      NOW,
    )
    expect(result.upfrontCost).toBeCloseTo(1200, 1)
  })

  it('returns NOT_AFFORDABLE when price exceeds liquidity', () => {
    const result = runAffordabilityEngine(
      baseInput({ totalPrice: 12000 }),
      richDb(3000, 2000, 10000),
      NOW,
    )
    expect(result.classification).toBe('NOT_AFFORDABLE')
    expect(result.liquidityAfter).toBeLessThan(0)
  })

  it('accounts for monthlyRecurringCost in effectiveMonthlyCost', () => {
    const result = runAffordabilityEngine(
      baseInput({ totalPrice: 100, monthlyRecurringCost: 100 }),
      richDb(3000, 2000, 10000),
      NOW,
    )
    expect(result.effectiveMonthlyCost).toBeCloseTo(100, 1)
    expect(result.recurringMonthlyCost).toBeCloseTo(100, 1)
  })

  it('net recurring cost is reduced by linkedMonthlyIncome', () => {
    const result = runAffordabilityEngine(
      baseInput({ totalPrice: 100, monthlyRecurringCost: 200, linkedMonthlyIncome: 150 }),
      richDb(3000, 2000, 10000),
      NOW,
    )
    expect(result.effectiveMonthlyCost).toBeCloseTo(50, 1)
  })

  it('effectiveMonthlyCost is never negative', () => {
    const result = runAffordabilityEngine(
      baseInput({ totalPrice: 100, monthlyRecurringCost: 50, linkedMonthlyIncome: 200 }),
      richDb(3000, 2000, 10000),
      NOW,
    )
    expect(result.effectiveMonthlyCost).toBeGreaterThanOrEqual(0)
  })
})

// ── INSTALLMENTS payment ──────────────────────────────────────────────────────

describe('runAffordabilityEngine — installment payment', () => {
  const installmentInput = baseInput({
    totalPrice: 12000,
    paymentMode: 'INSTALLMENTS',
    downPayment: 2000,
    installmentAmount: 250,
    numberOfInstallments: 40,
    firstInstallmentDate: '2026-08-01',
  })

  it('returns a classification', () => {
    const result = runAffordabilityEngine(installmentInput, richDb(3000, 2000, 10000), NOW)
    expect(['AFFORDABLE', 'CAUTION', 'RISKY', 'NOT_AFFORDABLE', 'INSUFFICIENT_DATA']).toContain(result.classification)
  })

  it('upfrontCost equals downPayment + additional', () => {
    const result = runAffordabilityEngine(installmentInput, richDb(3000, 2000, 10000), NOW)
    expect(result.upfrontCost).toBeCloseTo(2000, 1)
  })

  it('monthlyInstallment matches input', () => {
    const result = runAffordabilityEngine(installmentInput, richDb(3000, 2000, 10000), NOW)
    expect(result.monthlyInstallment).toBeCloseTo(250, 1)
  })

  it('installmentToMarginRatio is computed', () => {
    const result = runAffordabilityEngine(installmentInput, richDb(3000, 2000, 10000), NOW)
    // margin = 3000 - 2000 = 1000, installment = 250, ratio = 0.25
    expect(result.installmentToMarginRatio).toBeCloseTo(0.25, 2)
  })

  it('installmentToMarginRatio is null for IMMEDIATE mode', () => {
    const result = runAffordabilityEngine(baseInput(), richDb(), NOW)
    expect(result.installmentToMarginRatio).toBeNull()
  })

  it('includes balloon payment in result', () => {
    const input = baseInput({
      totalPrice: 12000,
      paymentMode: 'INSTALLMENTS',
      downPayment: 1000,
      installmentAmount: 200,
      numberOfInstallments: 36,
      balloonPayment: 3000,
    })
    const result = runAffordabilityEngine(input, richDb(3000, 2000, 10000), NOW)
    expect(result.balloonPayment).toBeCloseTo(3000, 1)
  })

  it('returns NOT_AFFORDABLE for unaffordable installments', () => {
    // Installment = 1500, margin = 1000 → not affordable
    const input = baseInput({
      totalPrice: 20000,
      paymentMode: 'INSTALLMENTS',
      downPayment: 500,
      installmentAmount: 1500,
      numberOfInstallments: 12,
    })
    const result = runAffordabilityEngine(input, richDb(3000, 2000, 10000), NOW)
    // marginAfter = 1000 - 1500 = -500 → deeply negative
    expect(['RISKY', 'NOT_AFFORDABLE']).toContain(result.classification)
  })
})

// ── Baseline & margin ─────────────────────────────────────────────────────────

describe('runAffordabilityEngine — margin', () => {
  it('monthlyMarginBefore reflects income minus expenses', () => {
    const result = runAffordabilityEngine(baseInput(), richDb(3000, 2000, 10000), NOW)
    expect(result.monthlyMarginBefore).toBeCloseTo(1000, 1)
  })

  it('monthlyMarginAfter decreases by effectiveMonthlyCost', () => {
    const result = runAffordabilityEngine(
      baseInput({ totalPrice: 100, monthlyRecurringCost: 200 }),
      richDb(3000, 2000, 10000),
      NOW,
    )
    expect(result.monthlyMarginAfter).toBeCloseTo(1000 - 200, 1)
  })

  it('zero margin baseline → CAUTION or worse', () => {
    // income = expenses → margin = 0
    const result = runAffordabilityEngine(
      baseInput({ totalPrice: 100, monthlyRecurringCost: 100 }),
      richDb(2000, 2000, 10000),
      NOW,
    )
    expect(['CAUTION', 'RISKY', 'NOT_AFFORDABLE']).toContain(result.classification)
  })
})

// ── Coverage months ───────────────────────────────────────────────────────────

describe('runAffordabilityEngine — coverage months', () => {
  it('coverageMonthsBefore is computed', () => {
    // liquidity=10000, expenses=2000 → 5 months
    const result = runAffordabilityEngine(baseInput(), richDb(3000, 2000, 10000), NOW)
    expect(result.coverageMonthsBefore).toBeCloseTo(5, 1)
  })

  it('coverageMonthsAfter is reduced after upfront cost', () => {
    const result = runAffordabilityEngine(
      baseInput({ totalPrice: 2000 }),
      richDb(3000, 2000, 10000),
      NOW,
    )
    // liquidityAfter = 8000, expenses = 2000 → 4 months
    expect(result.coverageMonthsAfter).toBeCloseTo(4, 1)
  })

  it('coverageMonths is null when expenses are zero', () => {
    // Only income, no expenses in transactions
    const txs = [makeTx('income', 3000, '2026-07-15')]
    const db: AffordabilityDbData = {
      accounts: [makeAccount('acc1', 10000)],
      recurringRules: [],
      recentTransactions: txs,
      loans: [],
      loanPayments: [],
      goals: [],
      goalContributions: [],
    }
    const result = runAffordabilityEngine(baseInput(), db, NOW)
    expect(result.coverageMonthsBefore).toBeNull()
    expect(result.coverageMonthsAfter).toBeNull()
  })
})

// ── Projection ────────────────────────────────────────────────────────────────

describe('runAffordabilityEngine — projections', () => {
  it('projection has correct number of periods (horizonMonths)', () => {
    const result = runAffordabilityEngine(
      baseInput({ horizonMonths: 6 }),
      richDb(),
      NOW,
    )
    expect(result.projections).toHaveLength(6)
  })

  it('projection uses default 12 months horizon', () => {
    const result = runAffordabilityEngine(baseInput(), richDb(), NOW)
    expect(result.projections).toHaveLength(12)
  })

  it('negativeMonths is 0 for comfortable scenario', () => {
    const result = runAffordabilityEngine(
      baseInput({ totalPrice: 500 }),
      richDb(3000, 2000, 10000),
      NOW,
    )
    expect(result.negativeMonths).toBe(0)
  })

  it('scenarioLiquidity diverges from baselineLiquidity in the purchase month', () => {
    // Purchase date 2026-07-01 is month 0 in a July-start projection
    const result = runAffordabilityEngine(
      baseInput({ totalPrice: 2000, purchaseDate: '2026-07-01' }),
      richDb(3000, 2000, 10000),
      NOW,
    )
    const purchaseMonth = result.projections[0]
    expect(purchaseMonth.scenarioLiquidity).toBeLessThan(purchaseMonth.baselineLiquidity)
  })

  it('projection contains period and label fields', () => {
    const result = runAffordabilityEngine(baseInput(), richDb(), NOW)
    const p = result.projections[0]
    expect(p).toHaveProperty('period')
    expect(p).toHaveProperty('label')
    expect(p).toHaveProperty('baselineLiquidity')
    expect(p).toHaveProperty('scenarioLiquidity')
  })
})

// ── Max affordable price ──────────────────────────────────────────────────────

describe('runAffordabilityEngine — maxAffordablePrice', () => {
  it('computes maxAffordablePrice for IMMEDIATE mode', () => {
    const result = runAffordabilityEngine(
      baseInput({ totalPrice: 100 }),
      richDb(3000, 2000, 10000),
      NOW,
    )
    // minBuffer = 3 months * 2000 = 6000; maxPrice = 10000 - 6000 = 4000
    expect(result.maxAffordablePrice).toBeCloseTo(4000, 0)
  })

  it('maxAffordablePrice is null when liquidity is insufficient', () => {
    // balance = 3000, minBuffer = 3 * 2000 = 6000 → no room
    const result = runAffordabilityEngine(
      baseInput({ totalPrice: 100 }),
      richDb(3000, 2000, 3000),
      NOW,
    )
    expect(result.maxAffordablePrice).toBeNull()
  })

  it('maxAffordablePrice is null for INSUFFICIENT_DATA', () => {
    const result = runAffordabilityEngine(baseInput(), emptyDb(), NOW)
    expect(result.maxAffordablePrice).toBeNull()
  })
})

// ── Data quality & assumptions ────────────────────────────────────────────────

describe('runAffordabilityEngine — data quality', () => {
  it('marks MEDIA quality with 3 months of transactions (lookback window)', () => {
    // LOOKBACK_MONTHS=3: max 3 distinct months can be captured → MEDIA (>=2 months)
    const result = runAffordabilityEngine(baseInput(), richDb(3000, 2000, 10000), NOW)
    expect(result.dataQuality).toBe('MEDIA')
  })

  it('falls back to recurring rules when no transactions', () => {
    const db: AffordabilityDbData = {
      accounts: [makeAccount('acc1', 10000)],
      recurringRules: [makeRule('income', 3000, 'monthly'), makeRule('expense', 2000, 'monthly')],
      recentTransactions: [],
      loans: [],
      loanPayments: [],
      goals: [],
      goalContributions: [],
    }
    const result = runAffordabilityEngine(baseInput(), db, NOW)
    expect(result.dataQuality).toBe('BASSA') // recurring only
    expect(result.monthlyMarginBefore).toBeCloseTo(1000, 1)
  })

  it('result contains disclaimer', () => {
    const result = runAffordabilityEngine(baseInput(), richDb(), NOW)
    expect(result.disclaimer).toContain('Aurora')
    expect(result.disclaimer.length).toBeGreaterThan(0)
  })

  it('result contains assumptions array', () => {
    const result = runAffordabilityEngine(baseInput(), richDb(), NOW)
    expect(Array.isArray(result.assumptions)).toBe(true)
    expect(result.assumptions.length).toBeGreaterThan(0)
  })

  it('missingData is populated when no income found', () => {
    const db: AffordabilityDbData = {
      accounts: [makeAccount('acc1', 10000)],
      recurringRules: [],
      recentTransactions: [makeTx('expense', 2000, '2026-07-15')],
      loans: [],
      loanPayments: [],
      goals: [],
      goalContributions: [],
    }
    const result = runAffordabilityEngine(baseInput(), db, NOW)
    expect(result.missingData.some((m) => m.includes('entrata'))).toBe(true)
  })
})

// ── Recurring rules ───────────────────────────────────────────────────────────

describe('runAffordabilityEngine — recurring rules', () => {
  it('weekly rule is converted to monthly equivalent (×4.33)', () => {
    const db: AffordabilityDbData = {
      accounts: [makeAccount('acc1', 10000)],
      recurringRules: [makeRule('income', 1000, 'weekly')], // 1000 * 4.33 = 4330/month
      recentTransactions: [],
      loans: [],
      loanPayments: [],
      goals: [],
      goalContributions: [],
    }
    const result = runAffordabilityEngine(baseInput(), db, NOW)
    expect(result.monthlyMarginBefore).toBeCloseTo(4330, 0)
  })

  it('yearly rule is converted to monthly equivalent (÷12)', () => {
    const db: AffordabilityDbData = {
      accounts: [makeAccount('acc1', 10000)],
      recurringRules: [makeRule('income', 12000, 'yearly')], // 12000/12 = 1000/month
      recentTransactions: [],
      loans: [],
      loanPayments: [],
      goals: [],
      goalContributions: [],
    }
    const result = runAffordabilityEngine(baseInput(), db, NOW)
    expect(result.monthlyMarginBefore).toBeCloseTo(1000, 0)
  })
})

// ── Monetary precision ────────────────────────────────────────────────────────

describe('runAffordabilityEngine — monetary precision', () => {
  it('rounds monetary values to 2 decimal places', () => {
    const result = runAffordabilityEngine(
      baseInput({ totalPrice: 1234.567 }),
      richDb(3333.33, 2222.22, 10000.01),
      NOW,
    )
    expect(result.liquidityAfter % 0.01).toBeCloseTo(0, 5)
  })

  it('liquidityBefore equals totalLiquidity in accounts', () => {
    const result = runAffordabilityEngine(baseInput(), richDb(3000, 2000, 10000), NOW)
    expect(result.liquidityBefore).toBeCloseTo(10000, 2)
  })
})

// ── Alternatives ──────────────────────────────────────────────────────────────

describe('runAffordabilityEngine — alternatives', () => {
  it('alternatives is an array', () => {
    const result = runAffordabilityEngine(baseInput(), richDb(), NOW)
    expect(Array.isArray(result.alternatives)).toBe(true)
  })

  it('reasons is a non-empty array with severity and category', () => {
    const result = runAffordabilityEngine(baseInput(), richDb(), NOW)
    expect(Array.isArray(result.reasons)).toBe(true)
    expect(result.reasons.length).toBeGreaterThan(0)
    for (const r of result.reasons) {
      expect(['critical', 'warning', 'info']).toContain(r.severity)
      expect(r.category).toBeTruthy()
    }
  })

  it('reasons are sorted critical first', () => {
    // Force a critical reason (negative liquidity)
    const result = runAffordabilityEngine(
      baseInput({ totalPrice: 12000 }),
      richDb(3000, 2000, 10000),
      NOW,
    )
    const severities = result.reasons.map((r) => r.severity)
    const firstInfo = severities.indexOf('info')
    const lastCritical = severities.lastIndexOf('critical')
    if (firstInfo !== -1 && lastCritical !== -1) {
      expect(lastCritical).toBeLessThan(firstInfo)
    }
  })
})

// ── Sustainability score ──────────────────────────────────────────────────────

describe('runAffordabilityEngine — sustainability score', () => {
  it('sustainabilityScore is null for INSUFFICIENT_DATA', () => {
    const result = runAffordabilityEngine(baseInput(), emptyDb(), NOW)
    expect(result.sustainabilityScore).toBeNull()
  })

  it('sustainabilityScore is a number 0-100 for valid data', () => {
    const result = runAffordabilityEngine(baseInput(), richDb(), NOW)
    expect(result.sustainabilityScore).not.toBeNull()
    expect(result.sustainabilityScore!).toBeGreaterThanOrEqual(0)
    expect(result.sustainabilityScore!).toBeLessThanOrEqual(100)
  })

  it('AFFORDABLE classification has higher score than NOT_AFFORDABLE', () => {
    const good = runAffordabilityEngine(baseInput({ totalPrice: 500 }), richDb(3000, 2000, 10000), NOW)
    const bad = runAffordabilityEngine(baseInput({ totalPrice: 15000 }), richDb(3000, 2000, 10000), NOW)
    expect(good.sustainabilityScore!).toBeGreaterThan(bad.sustainabilityScore!)
  })
})
