import { describe, expect, it } from 'vitest'
import {
  buildDedupeKey,
  compareSeverity,
  deduplicateCandidates,
  evaluateNotificationRules,
} from '@/lib/notifications/engine'
import type { EngineInput, NotificationCandidate } from '@/lib/notifications/types'

const NOW = new Date('2026-07-26T12:00:00.000Z')

const emptyInput: EngineInput = {
  userId: 'user-1',
  now: NOW,
  accounts: [],
  budgets: [],
  recurringRules: [],
  goals: [],
  loans: [],
  recentLoanPayments: [],
  recentAutomationApplications: [],
  recentTransactions: [],
}

function candidate(overrides: Partial<NotificationCandidate> = {}): NotificationCandidate {
  return {
    dedupeKey:   'test:key',
    type:        'automation_failure',
    severity:    'INFO',
    title:       'Test',
    message:     'Test message',
    sourceType:  null,
    sourceId:    null,
    sourceUrl:   null,
    metadata:    {},
    isCondition: false,
    ...overrides,
  }
}

// ── compareSeverity ──────────────────────────────────────────────────────────

describe('compareSeverity', () => {
  it('INFO < WARNING', () => {
    expect(compareSeverity('INFO', 'WARNING')).toBeLessThan(0)
  })

  it('WARNING < CRITICAL', () => {
    expect(compareSeverity('WARNING', 'CRITICAL')).toBeLessThan(0)
  })

  it('CRITICAL > INFO', () => {
    expect(compareSeverity('CRITICAL', 'INFO')).toBeGreaterThan(0)
  })

  it('same severity returns 0', () => {
    expect(compareSeverity('WARNING', 'WARNING')).toBe(0)
  })
})

// ── buildDedupeKey ───────────────────────────────────────────────────────────

describe('buildDedupeKey', () => {
  it('joins string parts with colon', () => {
    expect(buildDedupeKey('budget_threshold', 'bud-1', '2026-07', '80')).toBe(
      'budget_threshold:bud-1:2026-07:80',
    )
  })

  it('converts numbers to strings', () => {
    expect(buildDedupeKey('a', 1, 'b', 2)).toBe('a:1:b:2')
  })
})

// ── deduplicateCandidates ────────────────────────────────────────────────────

describe('deduplicateCandidates', () => {
  it('returns empty array for empty input', () => {
    expect(deduplicateCandidates([])).toEqual([])
  })

  it('returns single candidate unchanged', () => {
    const c = candidate()
    expect(deduplicateCandidates([c])).toEqual([c])
  })

  it('keeps unique keys as-is', () => {
    const a = candidate({ dedupeKey: 'key:1', severity: 'INFO' })
    const b = candidate({ dedupeKey: 'key:2', severity: 'WARNING' })
    const result = deduplicateCandidates([a, b])
    expect(result).toHaveLength(2)
  })

  it('deduplicates same key keeping highest severity', () => {
    const info    = candidate({ dedupeKey: 'same', severity: 'INFO' })
    const warning = candidate({ dedupeKey: 'same', severity: 'WARNING' })
    const result  = deduplicateCandidates([info, warning])
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('WARNING')
  })

  it('keeps CRITICAL over WARNING when deduplicating', () => {
    const warning  = candidate({ dedupeKey: 'x', severity: 'WARNING' })
    const critical = candidate({ dedupeKey: 'x', severity: 'CRITICAL' })
    const result   = deduplicateCandidates([critical, warning])
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('CRITICAL')
  })

  it('keeps CRITICAL regardless of order', () => {
    const warning  = candidate({ dedupeKey: 'x', severity: 'WARNING' })
    const critical = candidate({ dedupeKey: 'x', severity: 'CRITICAL' })
    // WARNING first
    expect(deduplicateCandidates([warning, critical])[0].severity).toBe('CRITICAL')
    // CRITICAL first
    expect(deduplicateCandidates([critical, warning])[0].severity).toBe('CRITICAL')
  })
})

// ── evaluateNotificationRules ────────────────────────────────────────────────

describe('evaluateNotificationRules', () => {
  it('returns empty array for empty input', () => {
    expect(evaluateNotificationRules(emptyInput)).toEqual([])
  })

  it('returns budget_threshold candidate for budget at 100%', () => {
    const input: EngineInput = {
      ...emptyInput,
      budgets: [{
        budgetId: 'bud-1', categoryId: 'cat-1', categoryName: 'Spesa',
        categoryIcon: null, parentCategoryName: null,
        year: 2026, month: 7, amount: 300, spent: 300,
        remaining: 0, percentage: 100, status: 'exceeded',
      }],
    }
    const result = evaluateNotificationRules(input)
    expect(result.some((c) => c.type === 'budget_threshold')).toBe(true)
  })

  it('returns automation_failure for FAILED application', () => {
    const input: EngineInput = {
      ...emptyInput,
      recentAutomationApplications: [{
        id: 'app-1', rule_id: 'rule-1', transaction_id: 'tx-1',
        application_batch_id: null, result: 'FAILED',
        error_code: null, applied_at: '2026-07-26T10:00:00.000Z', applied_values: {},
      }],
    }
    const result = evaluateNotificationRules(input)
    expect(result.some((c) => c.type === 'automation_failure')).toBe(true)
  })

  it('deduplicates candidates from engine output', () => {
    // Two budgets with the same budgetId in same period → same dedupe key → deduplicated
    const budget = {
      budgetId: 'bud-1', categoryId: 'cat-1', categoryName: 'Spesa',
      categoryIcon: null, parentCategoryName: null,
      year: 2026, month: 7, amount: 300, spent: 300,
      remaining: 0, percentage: 100, status: 'exceeded' as const,
    }
    const input: EngineInput = { ...emptyInput, budgets: [budget] }
    const result = evaluateNotificationRules(input)
    const budgetCandidates = result.filter((c) => c.type === 'budget_threshold')
    // Should have exactly 1 (CRITICAL for :100), not 2
    expect(budgetCandidates).toHaveLength(1)
  })
})
