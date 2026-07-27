import { describe, expect, it } from 'vitest'
import { scanDataIntegrity, sortIssues, summarizeIssues } from '@/lib/data-integrity/engine'
import { createDataIntegrityFingerprint } from '@/lib/data-integrity/fingerprint'
import { DATA_INTEGRITY_RULES, isDataIntegrityRuleCode } from '@/lib/data-integrity/registry'
import type { DataIntegrityInput } from '@/lib/data-integrity/types'

const now = '2026-07-27T12:00:00.000Z'

function input(overrides: Partial<DataIntegrityInput> = {}): DataIntegrityInput {
  const base: DataIntegrityInput = {
    userId: 'user-a',
    now,
    accounts: [
      { id: 'acc-a', user_id: 'user-a', name: 'Bancoposta', type: 'checking', color: null, icon: null, balance: 1000, currency: 'EUR', is_active: true, is_hidden: false, sort_order: 0, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
      { id: 'acc-b', user_id: 'user-a', name: 'Paypal', type: 'checking', color: null, icon: null, balance: 200, currency: 'EUR', is_active: true, is_hidden: false, sort_order: 1, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
    ],
    categories: [
      { id: 'cat-food', user_id: 'user-a', name: 'Alimentari', type: 'expense', color: null, icon: null, parent_id: null, is_default: false, sort_order: 0, created_at: '2026-01-01T00:00:00.000Z' },
      { id: 'cat-income', user_id: 'user-a', name: 'Stipendio', type: 'income', color: null, icon: null, parent_id: null, is_default: false, sort_order: 0, created_at: '2026-01-01T00:00:00.000Z' },
    ],
    transactions: [
      { id: 'tx-1', user_id: 'user-a', account_id: 'acc-a', category_id: 'cat-food', type: 'expense', amount: 10, description: 'DECO', notes: null, date: '2026-07-10', transfer_peer_id: null, recurring_id: null, receipt_url: null, receipt_data: null, created_at: '2026-07-10T00:00:00.000Z', updated_at: '2026-07-10T00:00:00.000Z' },
    ],
    recurringRules: [],
    budgets: [],
    goals: [],
    goalContributions: [],
    loans: [],
    loanPayments: [],
    notifications: [],
    financialHealthSnapshots: [],
  }
  return { ...base, ...overrides }
}

describe('data-integrity engine', () => {
  it('creates stable fingerprints independent from entity order', () => {
    const a = createDataIntegrityFingerprint({ userId: 'u1', ruleCode: 'TRANSACTION_EXACT_DUPLICATE', entityType: 'transaction', entityIds: ['b', 'a'] })
    const b = createDataIntegrityFingerprint({ userId: 'u1', ruleCode: 'TRANSACTION_EXACT_DUPLICATE', entityType: 'transaction', entityIds: ['a', 'b'] })
    const c = createDataIntegrityFingerprint({ userId: 'u2', ruleCode: 'TRANSACTION_EXACT_DUPLICATE', entityType: 'transaction', entityIds: ['a', 'b'] })
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })

  it('has unique rule codes and valid registry entries', () => {
    const codes = DATA_INTEGRITY_RULES.map((rule) => rule.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(DATA_INTEGRITY_RULES.every((rule) => isDataIntegrityRuleCode(rule.code) && rule.allowedActions.includes('ignore'))).toBe(true)
  })

  it('detects exact duplicate transactions but ignores valid transfers', () => {
    const result = scanDataIntegrity(input({
      transactions: [
        input().transactions[0],
        { ...input().transactions[0], id: 'tx-2' },
        { ...input().transactions[0], id: 'tr-1', type: 'transfer', category_id: null, transfer_peer_id: 'acc-b' },
      ],
    }))
    expect(result.issues.some((issue) => issue.ruleCode === 'TRANSACTION_EXACT_DUPLICATE')).toBe(true)
    expect(result.issues.some((issue) => issue.ruleCode === 'TRANSFER_MISSING_COUNTERPART')).toBe(false)
  })

  it('detects transfer anomalies conservatively', () => {
    const result = scanDataIntegrity(input({
      transactions: [
        { ...input().transactions[0], id: 'tr-missing', type: 'transfer', category_id: null, transfer_peer_id: null },
        { ...input().transactions[0], id: 'tr-same', type: 'transfer', category_id: null, transfer_peer_id: 'acc-a' },
        { ...input().transactions[0], id: 'tr-orphan', type: 'transfer', category_id: null, transfer_peer_id: 'tx-missing' },
      ],
    }))
    expect(result.issues.map((issue) => issue.ruleCode)).toEqual(expect.arrayContaining(['TRANSFER_MISSING_COUNTERPART', 'TRANSFER_SAME_ACCOUNT', 'TRANSFER_LEGACY_PEER_ORPHAN']))
  })

  it('detects legacy transfer peer incoherence and amount mismatches', () => {
    const result = scanDataIntegrity(input({
      transactions: [
        { ...input().transactions[0], id: 'tr-legacy-a', type: 'transfer', category_id: null, amount: 113.5, transfer_peer_id: 'tr-legacy-b' },
        { ...input().transactions[0], id: 'tr-legacy-b', type: 'transfer', category_id: null, account_id: 'acc-b', amount: 100, transfer_peer_id: 'tr-other' },
      ],
    }))
    expect(result.issues.map((issue) => issue.ruleCode)).toEqual(expect.arrayContaining([
      'TRANSFER_LEGACY_PEER_INCOHERENT',
      'TRANSFER_LEGACY_AMOUNT_MISMATCH',
    ]))
  })

  it('detects orphan references, missing category and invalid amount', () => {
    const result = scanDataIntegrity(input({
      transactions: [
        { ...input().transactions[0], id: 'bad', account_id: 'missing', category_id: 'missing-cat', amount: 0, recurring_id: 'missing-rec' },
        { ...input().transactions[0], id: 'uncat', category_id: null },
        { ...input().transactions[0], id: 'future', date: '2028-01-01' },
      ],
    }))
    expect(result.issues.map((issue) => issue.ruleCode)).toEqual(expect.arrayContaining([
      'TRANSACTION_ORPHAN_ACCOUNT',
      'TRANSACTION_ORPHAN_CATEGORY',
      'TRANSACTION_ORPHAN_RECURRING',
      'TRANSACTION_INVALID_AMOUNT',
      'TRANSACTION_MISSING_CATEGORY',
      'TRANSACTION_FUTURE_ANOMALY',
    ]))
  })

  it('detects possible duplicates across different categories', () => {
    const result = scanDataIntegrity(input({
      categories: [
        ...input().categories,
        { ...input().categories[0], id: 'cat-food-2', name: 'Supermercato' },
      ],
      transactions: [
        input().transactions[0],
        { ...input().transactions[0], id: 'tx-similar', category_id: 'cat-food-2' },
      ],
    }))
    expect(result.issues.some((issue) => issue.ruleCode === 'TRANSACTION_POSSIBLE_DUPLICATE')).toBe(true)
  })

  it('detects recurring, budget, loan and goal inconsistencies', () => {
    const result = scanDataIntegrity(input({
      recurringRules: [
        { id: 'rec-1', user_id: 'user-a', account_id: 'missing', category_id: 'missing', type: 'expense', amount: 10, description: 'A', frequency: 'monthly', start_date: '2026-08-01', end_date: '2026-07-01', next_due_date: '2026-09-01', last_run_date: null, is_active: true, auto_create: true, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
        { id: 'rec-2', user_id: 'user-a', account_id: 'acc-a', category_id: 'cat-food', type: 'expense', amount: 20, description: 'B', frequency: 'monthly', start_date: '2026-07-01', end_date: null, next_due_date: null, last_run_date: null, is_active: true, auto_create: true, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
      ],
      transactions: [
        { ...input().transactions[0], id: 'rec-tx-1', recurring_id: 'rec-2', amount: 20, date: '2026-07-01' },
        { ...input().transactions[0], id: 'rec-tx-2', recurring_id: 'rec-2', amount: 20, date: '2026-07-01' },
      ],
      budgets: [
        { id: 'b1', user_id: 'user-a', category_id: 'missing', amount: 0, month: 13, year: 2026, created_at: now, updated_at: now },
        { id: 'b2', user_id: 'user-a', category_id: 'cat-food', amount: 100, month: 7, year: 2026, created_at: now, updated_at: now },
        { id: 'b3', user_id: 'user-a', category_id: 'cat-food', amount: 200, month: 7, year: 2026, created_at: now, updated_at: now },
      ],
      loans: [
        { id: 'loan-1', user_id: 'user-a', counterpart: 'Mario', type: 'received', amount: 100, remaining: 150, description: null, due_date: null, is_settled: true, settled_at: now, created_at: now, updated_at: now },
        { id: 'loan-2', user_id: 'user-a', counterpart: 'Anna', type: 'given', amount: 100, remaining: -1, description: null, due_date: null, is_settled: false, settled_at: null, created_at: now, updated_at: now },
      ],
      loanPayments: [
        { id: 'pay-1', loan_id: 'loan-1', user_id: 'user-a', amount: 10, paid_at: now, notes: null, created_at: now },
        { id: 'pay-2', loan_id: 'loan-1', user_id: 'user-a', amount: 10, paid_at: now, notes: null, created_at: now },
        { id: 'pay-orphan', loan_id: 'missing-loan', user_id: 'user-a', amount: 10, paid_at: now, notes: null, created_at: now },
      ],
      goals: [
        { id: 'goal-1', user_id: 'user-a', name: 'Casa', target_amount: 100, current_amount: 10, target_date: null, icon: null, color: null, notes: null, status: 'COMPLETED', archived: false, created_at: now, updated_at: now },
        { id: 'goal-2', user_id: 'user-a', name: 'Auto', target_amount: 100, current_amount: 120, target_date: null, icon: null, color: null, notes: null, status: 'ACTIVE', archived: false, created_at: now, updated_at: now },
      ],
      goalContributions: [
        { id: 'gc-1', goal_id: 'goal-2', user_id: 'user-a', amount: 60, date: '2026-07-01', note: 'A', created_at: now },
        { id: 'gc-2', goal_id: 'goal-2', user_id: 'user-a', amount: 60, date: '2026-07-01', note: 'A', created_at: now },
        { id: 'gc-orphan', goal_id: 'missing-goal', user_id: 'user-a', amount: 5, date: '2026-07-01', note: null, created_at: now },
      ],
    }))
    expect(result.issues.map((issue) => issue.ruleCode)).toEqual(expect.arrayContaining([
      'RECURRING_ORPHAN_ACCOUNT',
      'RECURRING_ORPHAN_CATEGORY',
      'RECURRING_INVALID_DATES',
      'RECURRING_ACTIVE_WITHOUT_NEXT_DATE',
      'RECURRING_DUPLICATE_INSTANCE',
      'BUDGET_ORPHAN_CATEGORY',
      'BUDGET_INVALID_AMOUNT',
      'BUDGET_INVALID_PERIOD',
      'BUDGET_DUPLICATE_SCOPE',
      'LOAN_REMAINING_NEGATIVE',
      'LOAN_REMAINING_EXCEEDS_AMOUNT',
      'LOAN_SETTLED_WITH_REMAINING',
      'LOAN_DUPLICATE_PAYMENT',
      'GOAL_COMPLETED_UNDER_TARGET',
      'GOAL_REACHED_NOT_COMPLETED',
      'GOAL_CONTRIBUTIONS_MISMATCH',
      'GOAL_DUPLICATE_CONTRIBUTION',
    ]))
  })

  it('detects category, snapshot and notification issues', () => {
    const result = scanDataIntegrity(input({
      categories: [
        ...input().categories,
        { ...input().categories[0], id: 'cat-food-2', name: 'alimentari' },
        { ...input().categories[0], id: 'cat-self', parent_id: 'cat-self' },
        { ...input().categories[0], id: 'cat-orphan', parent_id: 'missing-parent' },
      ],
      transactions: [{ ...input().transactions[0], category_id: 'cat-income' }],
      notifications: [
        { id: 'n1', user_id: 'user-a', type: 'budget_threshold', severity: 'WARNING', title: 'A', message: 'A', dedupe_key: 'same', source_type: 'account', source_id: 'missing', source_url: null, metadata: {}, is_read: false, read_at: null, archived_at: null, resolved_at: null, snoozed_until: null, last_snoozed_at: null, first_detected_at: now, last_detected_at: now, created_at: now, updated_at: now },
        { id: 'n2', user_id: 'user-a', type: 'budget_threshold', severity: 'WARNING', title: 'A', message: 'A', dedupe_key: 'same', source_type: null, source_id: null, source_url: null, metadata: {}, is_read: false, read_at: null, archived_at: null, resolved_at: null, snoozed_until: null, last_snoozed_at: null, first_detected_at: now, last_detected_at: now, created_at: now, updated_at: now },
        { id: 'n3', user_id: 'user-a', type: 'budget_threshold', severity: 'INFO', title: 'R', message: 'R', dedupe_key: 'resolved', source_type: null, source_id: null, source_url: null, metadata: {}, is_read: false, read_at: null, archived_at: null, resolved_at: now, snoozed_until: null, last_snoozed_at: null, first_detected_at: now, last_detected_at: now, created_at: now, updated_at: now },
        { id: 'n4', user_id: 'user-a', type: 'budget_threshold', severity: 'INFO', title: 'C', message: 'C', dedupe_key: 'category', source_type: 'category', source_id: 'missing-category', source_url: null, metadata: {}, is_read: true, read_at: now, archived_at: null, resolved_at: null, snoozed_until: null, last_snoozed_at: null, first_detected_at: now, last_detected_at: now, created_at: now, updated_at: now },
        { id: 'n5', user_id: 'user-a', type: 'budget_threshold', severity: 'INFO', title: 'G', message: 'G', dedupe_key: 'goal', source_type: 'goal', source_id: 'missing-goal', source_url: null, metadata: {}, is_read: true, read_at: now, archived_at: null, resolved_at: null, snoozed_until: null, last_snoozed_at: null, first_detected_at: now, last_detected_at: now, created_at: now, updated_at: now },
        { id: 'n6', user_id: 'user-a', type: 'budget_threshold', severity: 'INFO', title: 'L', message: 'L', dedupe_key: 'loan', source_type: 'loan', source_id: 'missing-loan', source_url: null, metadata: {}, is_read: true, read_at: now, archived_at: null, resolved_at: null, snoozed_until: null, last_snoozed_at: null, first_detected_at: now, last_detected_at: now, created_at: now, updated_at: now },
        { id: 'n7', user_id: 'user-a', type: 'budget_threshold', severity: 'INFO', title: 'R', message: 'R', dedupe_key: 'recurring', source_type: 'recurring', source_id: 'missing-recurring', source_url: null, metadata: {}, is_read: true, read_at: now, archived_at: null, resolved_at: null, snoozed_until: null, last_snoozed_at: null, first_detected_at: now, last_detected_at: now, created_at: now, updated_at: now },
      ],
      financialHealthSnapshots: [
        { id: 's1', user_id: 'user-a', period_key: '2026-07', period_start: '2026-07-01', period_end: '2026-07-31', total_score: 101, level: 'GOOD', is_provisional: false, data_quality: 'GOOD', observed_weight: 100, metrics: {}, component_scores: {}, factors: [], recommendations: [], calculation_version: '', calculated_at: now, created_at: now, updated_at: now },
        { id: 's2', user_id: 'user-a', period_key: '2026-07', period_start: '2026-07-01', period_end: '2026-07-31', total_score: 80, level: 'GOOD', is_provisional: false, data_quality: 'GOOD', observed_weight: 100, metrics: {}, component_scores: {}, factors: [], recommendations: [], calculation_version: '', calculated_at: now, created_at: now, updated_at: now },
        { id: 's3', user_id: 'user-a', period_key: '2026-08', period_start: '2026-08-01', period_end: '2026-08-31', total_score: 80, level: 'GOOD', is_provisional: false, data_quality: 'GOOD', observed_weight: 100, metrics: {}, component_scores: {}, factors: [], recommendations: [], calculation_version: 'v1', calculated_at: now, created_at: now, updated_at: now },
      ],
    }))
    expect(result.issues.map((issue) => issue.ruleCode)).toEqual(expect.arrayContaining([
      'CATEGORY_DUPLICATE_NAME',
      'CATEGORY_PARENT_SELF',
      'CATEGORY_PARENT_MISSING',
      'CATEGORY_TYPE_MISMATCH',
      'NOTIFICATION_DUPLICATE_ACTIVE',
      'NOTIFICATION_SOURCE_ORPHAN',
      'NOTIFICATION_RESOLVED_UNREAD',
      'FINANCIAL_HEALTH_SNAPSHOT_SCORE_OUT_OF_RANGE',
      'FINANCIAL_HEALTH_SNAPSHOT_VERSION_MISSING',
      'FINANCIAL_HEALTH_SNAPSHOT_DUPLICATE',
    ]))
  })

  it('summarizes and sorts issues by status and severity', () => {
    const issues = [
      { severity: 'INFO' as const, status: 'open' as const, lastDetectedAt: '2026-01-01' },
      { severity: 'CRITICAL' as const, status: 'open' as const, lastDetectedAt: '2026-01-02' },
      { severity: 'WARNING' as const, status: 'resolved' as const, lastDetectedAt: '2026-01-03' },
    ]
    expect(summarizeIssues(issues).statusLabel).toBe('Attenzione urgente')
    expect(sortIssues(issues)[0].severity).toBe('CRITICAL')
  })
})
