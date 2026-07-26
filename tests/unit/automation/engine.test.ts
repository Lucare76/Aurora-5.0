import { describe, expect, it } from 'vitest'
import { applyRuleActions, diffPatch } from '@/lib/automation/actions'
import { evaluateRules, matchesRule, calculateRulePreview } from '@/lib/automation/engine'
import { matchesCondition, normalizeTextForAutomation } from '@/lib/automation/matcher'
import type { AutomationReferences, AutomationRule, AutomationTransaction } from '@/lib/automation/types'

const accountA = '10000000-0000-4000-8000-000000000001'
const accountB = '10000000-0000-4000-8000-000000000002'
const otherAccount = '10000000-0000-4000-8000-000000000003'
const catBills = '20000000-0000-4000-8000-000000000001'
const catBetting = '20000000-0000-4000-8000-000000000002'

const references: AutomationReferences = {
  accounts: [
    { id: accountA, user_id: 'user', name: 'Banca', is_active: true, is_hidden: false },
    { id: accountB, user_id: 'user', name: 'PayPal', is_active: true, is_hidden: false },
    { id: otherAccount, user_id: 'user', name: 'Archivio', is_active: false, is_hidden: false },
  ],
  categories: [
    { id: catBills, user_id: 'user', name: 'Bollette', type: 'expense', parent_id: null },
    { id: catBetting, user_id: 'user', name: 'Scommesse', type: 'expense', parent_id: null },
  ],
}

function tx(overrides: Partial<AutomationTransaction> = {}): AutomationTransaction {
  return {
    id: '30000000-0000-4000-8000-000000000001',
    user_id: 'user',
    account_id: accountA,
    category_id: null,
    type: 'expense',
    amount: 113.5,
    description: 'MARATHONBET',
    notes: null,
    date: '2026-07-25',
    transfer_peer_id: null,
    created_at: '2026-07-25T10:00:00.000Z',
    updated_at: '2026-07-25T10:00:00.000Z',
    ...overrides,
  }
}

function rule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: overrides.id ?? '40000000-0000-4000-8000-000000000001',
    user_id: 'user',
    name: overrides.name ?? 'Marathonbet',
    description: null,
    is_active: overrides.is_active ?? true,
    priority: overrides.priority ?? 10,
    match_mode: overrides.match_mode ?? 'ALL',
    stop_processing: overrides.stop_processing ?? true,
    apply_to_new_transactions: overrides.apply_to_new_transactions ?? false,
    archived: overrides.archived ?? false,
    conditions: overrides.conditions ?? [{ type: 'description', operator: 'CONTAINS', value: 'marathòn' }],
    actions: overrides.actions ?? [{ type: 'set_category', category_id: catBetting }],
    created_at: overrides.created_at ?? '2026-07-01T00:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-07-01T00:00:00.000Z',
  }
}

describe('automation deterministic matcher', () => {
  it('normalizes case accents and spaces', () => {
    expect(normalizeTextForAutomation('  MARATHÒNBET  ')).toBe('marathonbet')
    expect(matchesCondition({ type: 'description', operator: 'CONTAINS', value: 'marathon' }, tx()).matched).toBe(true)
  })

  it('supports description operators', () => {
    expect(matchesCondition({ type: 'description', operator: 'EQUALS', value: 'MARATHONBET' }, tx()).matched).toBe(true)
    expect(matchesCondition({ type: 'description', operator: 'STARTS_WITH', value: 'MARA' }, tx()).matched).toBe(true)
    expect(matchesCondition({ type: 'description', operator: 'ENDS_WITH', value: 'BET' }, tx()).matched).toBe(true)
    expect(matchesCondition({ type: 'description', operator: 'NOT_CONTAINS', value: 'NETFLIX' }, tx()).matched).toBe(true)
  })

  it('compares money in cents and supports between', () => {
    expect(matchesCondition({ type: 'amount', operator: 'EQUALS', value: 113.5 }, tx()).matched).toBe(true)
    expect(matchesCondition({ type: 'amount', operator: 'GREATER_THAN', value: 100 }, tx()).matched).toBe(true)
    expect(matchesCondition({ type: 'amount', operator: 'LESS_THAN_OR_EQUAL', value: 113.5 }, tx()).matched).toBe(true)
    expect(matchesCondition({ type: 'amount', operator: 'BETWEEN', min: 113.49, max: 113.51 }, tx()).matched).toBe(true)
  })

  it('supports type account category and date conditions with ALL or ANY', () => {
    const complex = rule({
      match_mode: 'ALL',
      conditions: [
        { type: 'transaction_type', value: 'expense' },
        { type: 'account', account_id: accountA, mode: 'SELECTED' },
        { type: 'category', category_id: null, mode: 'NONE' },
        { type: 'date', date_from: '2026-07-01', date_to: '2026-07-31', day_of_month: 25 },
      ],
    })
    expect(matchesRule(complex, tx(), references).matched).toBe(true)
  })
})

describe('automation engine', () => {
  it('applies one matching rule and builds a patch', () => {
    const result = evaluateRules(tx(), [rule()], references)
    expect(result.suggestedChanges).toEqual({ category_id: catBetting })
    expect(result.appliedRules).toHaveLength(1)
  })

  it('respects priority and stop processing', () => {
    const low = rule({ id: '40000000-0000-4000-8000-000000000002', priority: 20, actions: [{ type: 'set_category', category_id: catBills }] })
    const high = rule({ priority: 5, stop_processing: true })
    expect(evaluateRules(tx(), [low, high], references).suggestedChanges.category_id).toBe(catBetting)
  })

  it('continues when stop processing is false without overwriting existing fields', () => {
    const first = rule({ stop_processing: false, actions: [{ type: 'set_category', category_id: catBetting }] })
    const second = rule({ id: '40000000-0000-4000-8000-000000000002', priority: 20, actions: [{ type: 'set_account', account_id: accountB }] })
    expect(evaluateRules(tx(), [first, second], references).suggestedChanges).toEqual({ category_id: catBetting, account_id: accountB })
  })

  it('detects incompatible same-priority rules deterministically', () => {
    const a = rule({ priority: 10, stop_processing: false, actions: [{ type: 'set_category', category_id: catBetting }] })
    const b = rule({ id: '40000000-0000-4000-8000-000000000002', priority: 10, stop_processing: false, actions: [{ type: 'set_category', category_id: catBills }] })
    expect(evaluateRules(tx(), [a, b], references).conflicts).toContain('PRIORITY_10_CATEGORY_ID')
  })

  it('skips inactive and archived rules', () => {
    expect(matchesRule(rule({ is_active: false }), tx(), references).skippedReason).toBe('RULE_INACTIVE')
    expect(matchesRule(rule({ archived: true }), tx(), references).skippedReason).toBe('RULE_ARCHIVED')
  })

  it('protects transfers unless the rule targets transfer explicitly and forbids unsafe transfer actions', () => {
    expect(matchesRule(rule(), tx({ type: 'transfer', transfer_peer_id: accountB }), references).skippedReason).toBe('TRANSFER_NOT_EXPLICIT')
    const transferRule = rule({ conditions: [{ type: 'transaction_type', value: 'transfer' }], actions: [{ type: 'set_category', category_id: catBetting }] })
    expect(matchesRule(transferRule, tx({ type: 'transfer', transfer_peer_id: accountB }), references).skippedReason).toBe('TRANSFER_PROTECTED')
  })

  it('validates action references and calculates preview rows without writing', () => {
    expect(applyRuleActions(tx(), [{ type: 'set_account', account_id: otherAccount }], references).skippedReason).toBe('INVALID_ACCOUNT')
    expect(calculateRulePreview(rule(), [tx(), tx({ id: '30000000-0000-4000-8000-000000000002', description: 'NETFLIX' })], references)).toHaveLength(1)
  })

  it('builds previous and applied values only for changed fields', () => {
    expect(diffPatch(tx(), { category_id: catBetting, account_id: accountA }).appliedValues).toEqual({ category_id: catBetting })
  })
})
