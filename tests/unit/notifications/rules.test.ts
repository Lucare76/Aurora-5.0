import { describe, expect, it } from 'vitest'
import {
  evaluateAutomationRules,
  evaluateBalanceRules,
  evaluateBudgetRules,
  evaluateDuplicateRules,
  evaluateGoalRules,
  evaluateLoanRules,
  evaluateRecurrenceRules,
} from '@/lib/notifications/rules'
import type {
  Account,
  AutomationRuleApplication,
  Loan,
  LoanPayment,
  RecurringRule,
  SavingsGoal,
  Transaction,
} from '@/types/database'
import type { BudgetEntry } from '@/lib/budgets/service'

// ── Fixed "now" ─────────────────────────────────────────────────────────────

const NOW = new Date('2026-07-26T12:00:00.000Z')  // 2026-07-26

// ── Factory helpers ──────────────────────────────────────────────────────────

const uid = 'user-1'

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-1', user_id: uid, name: 'Conto Corrente',
    type: 'checking', color: null, icon: null,
    balance: 500, currency: 'EUR', is_active: true, is_hidden: false,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeRecurringRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: 'rule-1', user_id: uid, account_id: 'acc-1',
    description: 'Affitto', type: 'expense', amount: 100,
    frequency: 'monthly', next_due_date: '2026-07-27',
    start_date: '2026-01-01', end_date: null, last_run_date: null,
    is_active: true, auto_create: false, category_id: null,
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeBudget(overrides: Partial<BudgetEntry> = {}): BudgetEntry {
  return {
    budgetId: 'bud-1', categoryId: 'cat-1', categoryName: 'Spesa',
    categoryIcon: null, parentCategoryName: null,
    year: 2026, month: 7, amount: 300, spent: 0,
    remaining: 300, percentage: 0, status: 'safe',
    ...overrides,
  }
}

function makeGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: 'goal-1', user_id: uid, name: 'Vacanze',
    target_amount: 1000, current_amount: 0,
    target_date: '2027-07-26',  // 1 year from now
    status: 'ACTIVE', archived: false,
    color: null, icon: null, notes: null,
    created_at: '2026-01-26T00:00:00.000Z', updated_at: '2026-01-26T00:00:00.000Z',
    ...overrides,
  }
}

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 'loan-1', user_id: uid, type: 'received',
    counterpart: 'Mario', amount: 500, remaining: 500,
    description: null, due_date: '2026-08-26',
    is_settled: false, settled_at: null,
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeApp(
  overrides: Partial<Pick<AutomationRuleApplication,
    'id' | 'rule_id' | 'transaction_id' | 'application_batch_id' |
    'result' | 'error_code' | 'applied_at' | 'applied_values'>> = {},
): Pick<AutomationRuleApplication,
  'id' | 'rule_id' | 'transaction_id' | 'application_batch_id' |
  'result' | 'error_code' | 'applied_at' | 'applied_values'> {
  return {
    id: 'app-1', rule_id: 'rule-1', transaction_id: 'tx-1',
    application_batch_id: null, result: 'APPLIED',
    error_code: null, applied_at: '2026-07-26T10:00:00.000Z', applied_values: {},
    ...overrides,
  }
}

function makeTx(
  overrides: Partial<Pick<Transaction, 'id' | 'account_id' | 'type' | 'amount' | 'description' | 'date' | 'transfer_peer_id'>> = {},
): Pick<Transaction, 'id' | 'account_id' | 'type' | 'amount' | 'description' | 'date' | 'transfer_peer_id'> {
  return {
    id: 'tx-1', account_id: 'acc-1', type: 'expense',
    amount: 50, description: 'Supermercato', date: '2026-07-25',
    transfer_peer_id: null,
    ...overrides,
  }
}

// ── evaluateBalanceRules ─────────────────────────────────────────────────────

describe('evaluateBalanceRules', () => {
  it('returns empty for no accounts', () => {
    expect(evaluateBalanceRules([], [], NOW)).toEqual([])
  })

  it('skips inactive accounts', () => {
    const account = makeAccount({ is_active: false })
    const rule    = makeRecurringRule({ amount: 600 }) // would go negative
    expect(evaluateBalanceRules([account], [rule], NOW)).toEqual([])
  })

  it('returns no candidate when balance stays positive', () => {
    const account = makeAccount({ balance: 500 })
    const rule    = makeRecurringRule({ amount: 100, next_due_date: '2026-07-27' })
    const result  = evaluateBalanceRules([account], [rule], NOW)
    expect(result).toHaveLength(0)
  })

  it('generates WARNING when projected balance goes negative (> -100)', () => {
    const account = makeAccount({ balance: 50, id: 'acc-A' })
    const rule    = makeRecurringRule({
      account_id: 'acc-A', amount: 80, next_due_date: '2026-07-27', type: 'expense',
    })
    const result = evaluateBalanceRules([account], [rule], NOW)
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('WARNING')
    expect(result[0].type).toBe('negative_projected_balance')
    expect(result[0].dedupeKey).toBe('negative_projected_balance:acc-A:2026-07-27')
    expect(result[0].sourceId).toBe('acc-A')
    expect(result[0].isCondition).toBe(true)
  })

  it('generates CRITICAL when projected balance goes below -100', () => {
    const account = makeAccount({ balance: 50, id: 'acc-B' })
    const rule    = makeRecurringRule({
      account_id: 'acc-B', amount: 200, next_due_date: '2026-07-27', type: 'expense',
    })
    const result = evaluateBalanceRules([account], [rule], NOW)
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('CRITICAL')
  })
})

// ── evaluateBudgetRules ──────────────────────────────────────────────────────

describe('evaluateBudgetRules', () => {
  it('returns empty for no budgets', () => {
    expect(evaluateBudgetRules([], NOW)).toEqual([])
  })

  it('returns no candidate for budget at 50%', () => {
    const b = makeBudget({ amount: 300, spent: 150, percentage: 50, status: 'safe' })
    expect(evaluateBudgetRules([b], NOW)).toHaveLength(0)
  })

  it('generates WARNING at 80%', () => {
    const b = makeBudget({ amount: 300, spent: 240, percentage: 80, status: 'warning' })
    const result = evaluateBudgetRules([b], NOW)
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('WARNING')
    expect(result[0].dedupeKey).toContain(':80')
    expect(result[0].type).toBe('budget_threshold')
    expect(result[0].isCondition).toBe(true)
  })

  it('generates CRITICAL at 100%', () => {
    const b = makeBudget({ amount: 300, spent: 300, percentage: 100, status: 'exceeded' })
    const result = evaluateBudgetRules([b], NOW)
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('CRITICAL')
    expect(result[0].dedupeKey).toContain(':100')
  })

  it('generates CRITICAL only (not WARNING) when over 100%', () => {
    const b = makeBudget({ amount: 300, spent: 450, percentage: 150, status: 'exceeded' })
    const result = evaluateBudgetRules([b], NOW)
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('CRITICAL')
    expect(result[0].dedupeKey).toContain(':100')
  })

  it('generates WARNING only when between 80% and 100%', () => {
    const b = makeBudget({ amount: 300, spent: 270, percentage: 90, status: 'warning' })
    const result = evaluateBudgetRules([b], NOW)
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('WARNING')
  })
})

// ── evaluateRecurrenceRules ──────────────────────────────────────────────────

describe('evaluateRecurrenceRules', () => {
  it('skips inactive rules', () => {
    const rule = makeRecurringRule({ is_active: false, next_due_date: '2026-07-27' })
    expect(evaluateRecurrenceRules([rule], NOW)).toHaveLength(0)
  })

  it('returns no candidate for rule due in 10 days (outside window)', () => {
    const rule = makeRecurringRule({ next_due_date: '2026-08-05' })
    expect(evaluateRecurrenceRules([rule], NOW)).toHaveLength(0)
  })

  it('generates INFO for rule due in 3 days', () => {
    const rule = makeRecurringRule({ next_due_date: '2026-07-29' })
    const result = evaluateRecurrenceRules([rule], NOW)
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('INFO')
    expect(result[0].type).toBe('upcoming_recurrence')
  })

  it('generates WARNING for rule due tomorrow (1 day)', () => {
    const rule = makeRecurringRule({ next_due_date: '2026-07-27' })
    const result = evaluateRecurrenceRules([rule], NOW)
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('WARNING')
  })

  it('generates WARNING for rule due today', () => {
    const rule = makeRecurringRule({ next_due_date: '2026-07-26' })
    const result = evaluateRecurrenceRules([rule], NOW)
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('WARNING')
    expect(result[0].type).toBe('upcoming_recurrence')
  })

  it('generates CRITICAL for overdue manual rule past critical threshold', () => {
    // 2026-07-18 is 8 days before NOW (2026-07-26), exceeds default overdueCriticalAfterDays=7
    const rule = makeRecurringRule({ next_due_date: '2026-07-18', auto_create: false })
    const result = evaluateRecurrenceRules([rule], NOW)
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('CRITICAL')
    expect(result[0].type).toBe('overdue_recurrence')
    expect(result[0].isCondition).toBe(true)
  })

  it('skips overdue rule when auto_create=true', () => {
    const rule = makeRecurringRule({ next_due_date: '2026-07-20', auto_create: true })
    expect(evaluateRecurrenceRules([rule], NOW)).toHaveLength(0)
  })
})

// ── evaluateGoalRules ────────────────────────────────────────────────────────

describe('evaluateGoalRules', () => {
  it('skips non-active goals', () => {
    const goal = makeGoal({ status: 'COMPLETED' })
    expect(evaluateGoalRules([goal], NOW)).toHaveLength(0)
  })

  it('skips goals without target_date', () => {
    const goal = makeGoal({ target_date: null })
    expect(evaluateGoalRules([goal], NOW)).toHaveLength(0)
  })

  it('skips goal on track (within tolerance)', () => {
    // 50% elapsed, 45% funded → gap = 5% (within 10% tolerance)
    const goal = makeGoal({
      target_amount: 1000, current_amount: 450,
      created_at: '2026-01-26T00:00:00.000Z',
      target_date: '2027-01-26',  // ~6 months total, ~6 months elapsed means 50%
    })
    const result = evaluateGoalRules([goal], NOW)
    expect(result).toHaveLength(0)
  })

  it('generates WARNING for goal behind schedule', () => {
    // Goal: 1000€, only 100€ saved (10% done)
    // Time: started 2026-01-01, ends 2026-12-31 → ~7 months elapsed of 12 → ~57% elapsed
    // Gap = 57% - 10% = 47% >> 10% tolerance → WARNING
    const goal = makeGoal({
      target_amount: 1000, current_amount: 100,
      created_at: '2026-01-01T00:00:00.000Z',
      target_date: '2026-12-31',
    })
    const result = evaluateGoalRules([goal], NOW)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('goal_behind_schedule')
    expect(result[0].isCondition).toBe(true)
  })

  it('generates CRITICAL when near deadline with large gap', () => {
    // Ends in 15 days (≤30 → CRITICAL_DAYS_LIMIT), started 1 year ago, 5% done
    const goal = makeGoal({
      target_amount: 1000, current_amount: 50,
      created_at: '2025-07-26T00:00:00.000Z',
      target_date: '2026-08-10',  // 15 days from now
    })
    const result = evaluateGoalRules([goal], NOW)
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('CRITICAL')
  })
})

// ── evaluateLoanRules ────────────────────────────────────────────────────────

describe('evaluateLoanRules', () => {
  it('skips settled loans', () => {
    const loan = makeLoan({ is_settled: true, due_date: '2026-07-20' })
    expect(evaluateLoanRules([loan], [], NOW)).toHaveLength(0)
  })

  it('skips loans without due_date', () => {
    const loan = makeLoan({ due_date: null })
    expect(evaluateLoanRules([loan], [], NOW)).toHaveLength(0)
  })

  it('generates CRITICAL for overdue loan', () => {
    const loan = makeLoan({ due_date: '2026-07-16' })  // 10 days ago
    const result = evaluateLoanRules([loan], [], NOW)
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('CRITICAL')
    expect(result[0].type).toBe('overdue_loan_payment')
    expect(result[0].isCondition).toBe(true)
  })

  it('generates WARNING for loan due today', () => {
    const loan = makeLoan({ due_date: '2026-07-26' })
    const result = evaluateLoanRules([loan], [], NOW)
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('WARNING')
    expect(result[0].type).toBe('upcoming_loan_payment')
  })

  it('generates INFO for loan due in 5 days', () => {
    const loan = makeLoan({ due_date: '2026-07-31' })  // 5 days ahead (within 7-day window)
    const result = evaluateLoanRules([loan], [], NOW)
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('INFO')
    expect(result[0].type).toBe('loan_due_soon')
  })

  it('generates WARNING for loan due in 2 days', () => {
    const loan = makeLoan({ due_date: '2026-07-28' })  // 2 days (≤ UPCOMING_DAYS_WARNING=3)
    const result = evaluateLoanRules([loan], [], NOW)
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('WARNING')
    expect(result[0].type).toBe('loan_due_soon')
  })

  it('returns no candidate for loan due in 30 days', () => {
    const loan = makeLoan({ due_date: '2026-08-25' })  // > 7-day window
    expect(evaluateLoanRules([loan], [], NOW)).toHaveLength(0)
  })
})

// ── evaluateAutomationRules ──────────────────────────────────────────────────

describe('evaluateAutomationRules', () => {
  it('returns empty for no applications', () => {
    expect(evaluateAutomationRules([])).toEqual([])
  })

  it('returns no candidate for APPLIED result', () => {
    const app = makeApp({ result: 'APPLIED' })
    expect(evaluateAutomationRules([app])).toHaveLength(0)
  })

  it('generates CRITICAL for FAILED application', () => {
    const app = makeApp({ result: 'FAILED', error_code: 'RULE_ERROR' })
    const result = evaluateAutomationRules([app])
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('CRITICAL')
    expect(result[0].type).toBe('automation_failure')
    expect(result[0].dedupeKey).toBe('automation_failure:app-1')
    expect(result[0].isCondition).toBe(false)
  })

  it('generates WARNING for CONFLICT application', () => {
    const app = makeApp({ result: 'CONFLICT' })
    const result = evaluateAutomationRules([app])
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('WARNING')
    expect(result[0].type).toBe('automation_conflict')
    expect(result[0].isCondition).toBe(false)
  })
})

// ── evaluateDuplicateRules ────────────────────────────────────────────────────

describe('evaluateDuplicateRules', () => {
  it('returns empty for no transactions', () => {
    expect(evaluateDuplicateRules([], NOW)).toEqual([])
  })

  it('returns no candidate for single transaction', () => {
    const tx = makeTx()
    expect(evaluateDuplicateRules([tx], NOW)).toHaveLength(0)
  })

  it('detects duplicate pair with same fingerprint', () => {
    const tx1 = makeTx({ id: 'tx-1' })
    const tx2 = makeTx({ id: 'tx-2' })
    const result = evaluateDuplicateRules([tx1, tx2], NOW)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('possible_duplicate')
    expect(result[0].severity).toBe('WARNING')
    expect(result[0].isCondition).toBe(false)
    // dedupe key uses stable ID ordering (lower id first)
    expect(result[0].dedupeKey).toBe('possible_duplicate:tx-1:tx-2')
  })

  it('dedupe key uses stable lexicographic ordering of IDs', () => {
    const tx1 = makeTx({ id: 'zzz-tx' })
    const tx2 = makeTx({ id: 'aaa-tx' })
    const result = evaluateDuplicateRules([tx1, tx2], NOW)
    expect(result[0].dedupeKey).toBe('possible_duplicate:aaa-tx:zzz-tx')
  })

  it('does not detect duplicate for different amounts', () => {
    const tx1 = makeTx({ id: 'tx-1', amount: 50 })
    const tx2 = makeTx({ id: 'tx-2', amount: 75 })
    expect(evaluateDuplicateRules([tx1, tx2], NOW)).toHaveLength(0)
  })

  it('excludes transfer transactions from duplicate detection', () => {
    const tx1 = makeTx({ id: 'tx-1', type: 'transfer', transfer_peer_id: 'tx-2' })
    const tx2 = makeTx({ id: 'tx-2', type: 'transfer', transfer_peer_id: 'tx-1' })
    expect(evaluateDuplicateRules([tx1, tx2], NOW)).toHaveLength(0)
  })

  it('excludes transactions outside 14-day window', () => {
    const tx1 = makeTx({ id: 'tx-1', date: '2026-07-01' })  // > 14 days ago
    const tx2 = makeTx({ id: 'tx-2', date: '2026-07-01' })
    expect(evaluateDuplicateRules([tx1, tx2], NOW)).toHaveLength(0)
  })
})
