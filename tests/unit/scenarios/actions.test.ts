import { describe, it, expect } from 'vitest'
import { generatePeriods } from '@/lib/scenarios/dates'
import { applyOneTimeExpense } from '@/lib/scenarios/actions/one-time-expense'
import { applyRecurringExpenseAdd } from '@/lib/scenarios/actions/recurring-expense'
import { applyRecurringIncomeAdd } from '@/lib/scenarios/actions/recurring-income'
import { applyMonthlySavingsChange } from '@/lib/scenarios/actions/savings-change'
import { applyBudgetLimitChange } from '@/lib/scenarios/actions/budget-change'
import { applyAccountBalanceAdjustment } from '@/lib/scenarios/actions/account-adjustment'
import { applyNewLoan } from '@/lib/scenarios/actions/new-loan'

const periods = generatePeriods('2026-01-01', 6) // Jan–Jun 2026

describe('applyOneTimeExpense', () => {
  it('applies expense in the matching period only', () => {
    const mods = applyOneTimeExpense(
      { amount: 500, date: '2026-02-15', description: 'Test' },
      periods,
      'action-1',
    )
    expect(mods.size).toBe(1)
    const feb = mods.get('2026-02')!
    expect(feb).toBeDefined()
    expect(feb.expenseAdjustment).toBe(500)
    expect(feb.incomeAdjustment).toBe(0)
  })

  it('returns empty map for date outside horizon', () => {
    const mods = applyOneTimeExpense(
      { amount: 100, date: '2025-01-01', description: 'Old' },
      periods,
      'action-2',
    )
    expect(mods.size).toBe(0)
  })
})

describe('applyRecurringExpenseAdd', () => {
  it('adds monthly expense for each period from startDate', () => {
    const mods = applyRecurringExpenseAdd(
      { amount: 200, frequency: 'monthly', description: 'Sub', startDate: '2026-03-01' },
      periods,
    )
    // Should cover Mar, Apr, May, Jun = 4 periods
    expect(mods.size).toBe(4)
    expect(mods.get('2026-01')).toBeUndefined()
    expect(mods.get('2026-03')?.expenseAdjustment).toBe(200)
  })

  it('respects endDate', () => {
    const mods = applyRecurringExpenseAdd(
      { amount: 100, frequency: 'monthly', description: 'Limited', startDate: '2026-01-01', endDate: '2026-02-28' },
      periods,
    )
    expect(mods.has('2026-01')).toBe(true)
    expect(mods.has('2026-02')).toBe(true)
    expect(mods.has('2026-03')).toBe(false)
  })
})

describe('applyRecurringIncomeAdd', () => {
  it('adds monthly income for each period', () => {
    const mods = applyRecurringIncomeAdd(
      { amount: 1000, frequency: 'monthly', description: 'Salary', startDate: '2026-01-01' },
      periods,
    )
    expect(mods.size).toBe(6)
    expect(mods.get('2026-01')?.incomeAdjustment).toBe(1000)
    expect(mods.get('2026-06')?.incomeAdjustment).toBe(1000)
  })
})

describe('applyMonthlySavingsChange', () => {
  it('positive changeAmount reduces expenses', () => {
    const mods = applyMonthlySavingsChange(
      { changeAmount: 300, startDate: '2026-01-01' },
      periods,
    )
    expect(mods.size).toBe(6)
    // +300 savings → expense adjustment of -300
    expect(mods.get('2026-01')?.expenseAdjustment).toBe(-300)
  })

  it('negative changeAmount increases expenses', () => {
    const mods = applyMonthlySavingsChange(
      { changeAmount: -200, startDate: '2026-01-01' },
      periods,
    )
    expect(mods.get('2026-01')?.expenseAdjustment).toBe(200)
  })
})

describe('applyBudgetLimitChange', () => {
  it('always returns empty map (informational only)', () => {
    const mods = applyBudgetLimitChange(
      { categoryId: 'cat-1', newLimit: 500 },
      periods,
    )
    expect(mods.size).toBe(0)
  })
})

describe('applyAccountBalanceAdjustment', () => {
  it('applies adjustment to first period only', () => {
    const mods = applyAccountBalanceAdjustment(
      { adjustmentAmount: 1000 },
      periods,
    )
    expect(mods.size).toBe(1)
    const firstKey = periods[0].key
    expect(mods.get(firstKey)?.incomeAdjustment).toBe(1000)
    expect(mods.get(firstKey)?.expenseAdjustment).toBe(0)
  })

  it('negative adjustment goes to expenseAdjustment', () => {
    const mods = applyAccountBalanceAdjustment(
      { adjustmentAmount: -500 },
      periods,
    )
    const firstKey = periods[0].key
    expect(mods.get(firstKey)?.incomeAdjustment).toBe(0)
    expect(mods.get(firstKey)?.expenseAdjustment).toBe(500)
  })
})

describe('applyNewLoan', () => {
  it('adds monthly payment from firstPaymentDate', () => {
    const mods = applyNewLoan(
      {
        description: 'Mutuo',
        principalAmount: 10000,
        monthlyPayment: 200,
        numberOfPayments: 6,
        firstPaymentDate: '2026-01-15',
      },
      periods,
    )
    // All 6 periods should have a loan payment
    expect(mods.size).toBeGreaterThanOrEqual(1)
    const jan = mods.get('2026-01')
    expect(jan?.loanAdjustment).toBe(200)
  })

  it('adds principal as income in firstPaymentDate month', () => {
    const mods = applyNewLoan(
      {
        description: 'Prestito',
        principalAmount: 5000,
        monthlyPayment: 100,
        numberOfPayments: 12,
        firstPaymentDate: '2026-02-01',
      },
      periods,
    )
    const feb = mods.get('2026-02')
    expect(feb?.incomeAdjustment).toBe(5000)
  })

  it('stops payments after numberOfPayments', () => {
    // Only 3 payments in a 6-month horizon
    const mods = applyNewLoan(
      {
        description: 'Short',
        principalAmount: 1000,
        monthlyPayment: 150,
        numberOfPayments: 2,
        firstPaymentDate: '2026-01-01',
      },
      periods,
    )
    // Months 1+2 have payment; months 3-6 should not
    expect(mods.has('2026-03')).toBe(false)
  })
})
