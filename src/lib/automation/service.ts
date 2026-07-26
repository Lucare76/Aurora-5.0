import type { SupabaseClient } from '@supabase/supabase-js'
import { diffPatch } from './actions'
import { calculateRulePreview, evaluateRules, matchesRule } from './engine'
import type {
  AutomationApplication,
  AutomationBatch,
  AutomationPreviewRow,
  AutomationReferences,
  AutomationRule,
  AutomationTransaction,
  AutomationTransactionDraft,
  AutomationTransactionPatch,
} from './types'
import { normalizeRuleInput, normalizeRuleRow, normalizeRuleRows } from './validators'

export const AUTOMATION_RULE_SELECT = 'id,user_id,name,description,is_active,priority,match_mode,stop_processing,apply_to_new_transactions,archived,conditions,actions,created_at,updated_at'
export const AUTOMATION_APPLICATION_SELECT = 'id,user_id,rule_id,transaction_id,application_batch_id,application_mode,previous_values,applied_values,result,error_code,applied_at,reverted_at'
export const AUTOMATION_BATCH_SELECT = 'id,user_id,rule_id,mode,status,transaction_count,applied_count,skipped_count,conflict_count,failed_count,created_at,reverted_at'
export const AUTOMATION_TX_SELECT = 'id,user_id,account_id,category_id,type,amount,description,notes,date,transfer_peer_id,created_at,updated_at'

type Db = SupabaseClient<any>
type DbError = { message?: string; code?: string } | null

export class AutomationError extends Error {
  constructor(public readonly code: string, message = code) {
    super(message)
    this.name = 'AutomationError'
  }
}

function assertNoError(error: DbError, code = 'AUTOMATION_FAILED') {
  if (error) throw new AutomationError(code)
}

export async function listAutomationRules(supabase: Db, userId: string): Promise<AutomationRule[]> {
  const { data, error } = await supabase
    .from('automation_rules')
    .select(AUTOMATION_RULE_SELECT)
    .eq('user_id', userId)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  assertNoError(error)
  return normalizeRuleRows(data ?? [])
}

export async function listActiveAutomationRules(supabase: Db, userId: string): Promise<AutomationRule[]> {
  const { data, error } = await supabase
    .from('automation_rules')
    .select(AUTOMATION_RULE_SELECT)
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('archived', false)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(100)
  assertNoError(error)
  return normalizeRuleRows(data ?? [])
}

export async function getAutomationRule(supabase: Db, userId: string, ruleId: string): Promise<AutomationRule> {
  const { data, error } = await supabase
    .from('automation_rules')
    .select(AUTOMATION_RULE_SELECT)
    .eq('user_id', userId)
    .eq('id', ruleId)
    .maybeSingle()
  assertNoError(error)
  if (!data) throw new AutomationError('RULE_NOT_FOUND')
  return normalizeRuleRow(data)
}

export async function createAutomationRule(supabase: Db, userId: string, body: unknown): Promise<AutomationRule> {
  const input = normalizeRuleInput(body)
  const { data, error } = await supabase
    .from('automation_rules')
    .insert({ ...input, user_id: userId })
    .select(AUTOMATION_RULE_SELECT)
    .single()
  assertNoError(error, 'INVALID_RULE')
  return normalizeRuleRow(data)
}

export async function updateAutomationRule(supabase: Db, userId: string, ruleId: string, body: unknown): Promise<AutomationRule> {
  await getAutomationRule(supabase, userId, ruleId)
  const input = normalizeRuleInput(body)
  const { data, error } = await supabase
    .from('automation_rules')
    .update(input)
    .eq('user_id', userId)
    .eq('id', ruleId)
    .select(AUTOMATION_RULE_SELECT)
    .single()
  assertNoError(error, 'INVALID_RULE')
  return normalizeRuleRow(data)
}

export async function deleteAutomationRule(supabase: Db, userId: string, ruleId: string): Promise<void> {
  await getAutomationRule(supabase, userId, ruleId)
  const { error } = await supabase.from('automation_rules').delete().eq('user_id', userId).eq('id', ruleId)
  assertNoError(error)
}

export async function loadAutomationReferences(supabase: Db, userId: string): Promise<AutomationReferences> {
  const [accountsRes, categoriesRes] = await Promise.all([
    supabase.from('accounts').select('id,user_id,name,is_active,is_hidden').eq('user_id', userId),
    supabase.from('categories').select('id,user_id,name,type,parent_id').eq('user_id', userId),
  ])
  assertNoError(accountsRes.error, 'INVALID_ACCOUNT')
  assertNoError(categoriesRes.error, 'INVALID_CATEGORY')
  return {
    accounts: accountsRes.data ?? [],
    categories: categoriesRes.data ?? [],
  }
}

export async function evaluateTransactionDraft(supabase: Db, userId: string, draft: AutomationTransactionDraft, options: { automaticOnly?: boolean } = {}) {
  const [rules, references] = await Promise.all([
    listActiveAutomationRules(supabase, userId),
    loadAutomationReferences(supabase, userId),
  ])
  return evaluateRules({ ...draft, id: draft.id ?? 'draft', user_id: userId, created_at: '', updated_at: '' }, rules, references, options)
}

export async function previewAutomationRule(
  supabase: Db,
  userId: string,
  ruleId: string,
  params: { from?: string; to?: string; limit?: number },
): Promise<AutomationPreviewRow[]> {
  const [rule, references] = await Promise.all([
    getAutomationRule(supabase, userId, ruleId),
    loadAutomationReferences(supabase, userId),
  ])
  let query = supabase
    .from('transactions')
    .select(AUTOMATION_TX_SELECT)
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(Math.min(params.limit ?? 20, 20))
  if (params.from) query = query.gte('date', params.from)
  if (params.to) query = query.lte('date', params.to)
  const { data, error } = await query
  assertNoError(error, 'PREVIEW_FAILED')
  return calculateRulePreview(rule, (data ?? []) as AutomationTransaction[], references).slice(0, params.limit ?? 20)
}

export async function listAutomationApplications(supabase: Db, userId: string, limit = 50): Promise<AutomationApplication[]> {
  const { data, error } = await supabase
    .from('automation_rule_applications')
    .select(AUTOMATION_APPLICATION_SELECT)
    .eq('user_id', userId)
    .order('applied_at', { ascending: false })
    .limit(Math.min(limit, 100))
  assertNoError(error)
  return (data ?? []) as AutomationApplication[]
}

async function insertApplication(supabase: Db, row: Omit<AutomationApplication, 'id' | 'applied_at' | 'reverted_at'>) {
  const { error } = await supabase.from('automation_rule_applications').insert(row)
  assertNoError(error)
}

export async function recordAutomaticApplications(
  supabase: Db,
  userId: string,
  transaction: AutomationTransaction,
  rules: AutomationRule[],
  previousValues: Partial<AutomationTransactionPatch>,
  appliedValues: Partial<AutomationTransactionPatch>,
) {
  for (const rule of rules) {
    await insertApplication(supabase, {
      user_id: userId,
      rule_id: rule.id,
      transaction_id: transaction.id,
      application_batch_id: null,
      application_mode: 'AUTOMATIC',
      previous_values: previousValues,
      applied_values: appliedValues,
      result: Object.keys(appliedValues).length > 0 ? 'APPLIED' : 'SKIPPED',
      error_code: null,
    })
  }
}

export async function applyAutomationRuleBulk(
  supabase: Db,
  userId: string,
  ruleId: string,
  params: { from: string; to: string; limit?: number },
): Promise<AutomationBatch> {
  const limit = Math.min(params.limit ?? 500, 500)
  const [rule, references] = await Promise.all([
    getAutomationRule(supabase, userId, ruleId),
    loadAutomationReferences(supabase, userId),
  ])
  const { data: txRows, error: txError } = await supabase
    .from('transactions')
    .select(AUTOMATION_TX_SELECT)
    .eq('user_id', userId)
    .gte('date', params.from)
    .lte('date', params.to)
    .order('date', { ascending: true })
    .limit(limit + 1)
  assertNoError(txError)
  const transactions = (txRows ?? []) as AutomationTransaction[]
  if (transactions.length > limit) throw new AutomationError('APPLY_LIMIT_EXCEEDED')

  const { data: batchRow, error: batchError } = await supabase
    .from('automation_application_batches')
    .insert({ user_id: userId, rule_id: rule.id, mode: 'BULK', transaction_count: transactions.length })
    .select(AUTOMATION_BATCH_SELECT)
    .single()
  assertNoError(batchError)
  if (!batchRow) throw new AutomationError('AUTOMATION_FAILED')

  let applied = 0
  let skipped = 0
  let conflict = 0
  let failed = 0

  for (const transaction of transactions) {
    const evaluation = matchesRule(rule, transaction, references)
    const { previousValues, appliedValues } = diffPatch(transaction, evaluation.changes)
    if (!evaluation.matched || evaluation.skippedReason || Object.keys(appliedValues).length === 0) {
      skipped += 1
      await insertApplication(supabase, {
        user_id: userId,
        rule_id: rule.id,
        transaction_id: transaction.id,
        application_batch_id: batchRow.id,
        application_mode: 'BULK',
        previous_values: previousValues,
        applied_values: appliedValues,
        result: evaluation.skippedReason ? 'SKIPPED' : 'SKIPPED',
        error_code: evaluation.skippedReason,
      })
      continue
    }
    if (evaluation.conflicts.length > 0) {
      conflict += 1
      await insertApplication(supabase, {
        user_id: userId,
        rule_id: rule.id,
        transaction_id: transaction.id,
        application_batch_id: batchRow.id,
        application_mode: 'BULK',
        previous_values: previousValues,
        applied_values: appliedValues,
        result: 'CONFLICT',
        error_code: evaluation.conflicts[0],
      })
      continue
    }

    const { error } = await supabase.rpc('update_transaction_atomic', {
      p_transaction_id: transaction.id,
      p_account_id: appliedValues.account_id ?? null,
      p_type: appliedValues.type ?? null,
      p_amount: null,
      p_date: null,
      p_description: appliedValues.description ?? null,
      p_category_id: Object.prototype.hasOwnProperty.call(appliedValues, 'category_id') ? appliedValues.category_id : null,
      p_notes: appliedValues.notes ?? null,
      p_destination_account_id: null,
      p_clear_category: Object.prototype.hasOwnProperty.call(appliedValues, 'category_id') && appliedValues.category_id === null,
    })
    if (error) {
      failed += 1
      await insertApplication(supabase, {
        user_id: userId,
        rule_id: rule.id,
        transaction_id: transaction.id,
        application_batch_id: batchRow.id,
        application_mode: 'BULK',
        previous_values: previousValues,
        applied_values: appliedValues,
        result: 'FAILED',
        error_code: 'AUTOMATION_FAILED',
      })
      continue
    }
    applied += 1
    await insertApplication(supabase, {
      user_id: userId,
      rule_id: rule.id,
      transaction_id: transaction.id,
      application_batch_id: batchRow.id,
      application_mode: 'BULK',
      previous_values: previousValues,
      applied_values: appliedValues,
      result: 'APPLIED',
      error_code: null,
    })
  }

  const status = failed > 0 || conflict > 0 ? 'PARTIAL' : 'COMPLETED'
  const { data: updatedBatch, error: updateError } = await supabase
    .from('automation_application_batches')
    .update({ status, applied_count: applied, skipped_count: skipped, conflict_count: conflict, failed_count: failed })
    .eq('user_id', userId)
    .eq('id', batchRow.id)
    .select(AUTOMATION_BATCH_SELECT)
    .single()
  assertNoError(updateError)
  return updatedBatch as AutomationBatch
}

export async function revertAutomationBatch(supabase: Db, userId: string, batchId: string): Promise<AutomationBatch> {
  const { data: batch, error: batchError } = await supabase
    .from('automation_application_batches')
    .select(AUTOMATION_BATCH_SELECT)
    .eq('user_id', userId)
    .eq('id', batchId)
    .maybeSingle()
  assertNoError(batchError, 'BATCH_NOT_FOUND')
  if (!batch) throw new AutomationError('BATCH_NOT_FOUND')
  if (batch.reverted_at) throw new AutomationError('BATCH_ALREADY_REVERTED')

  const { data: applications, error: appError } = await supabase
    .from('automation_rule_applications')
    .select(AUTOMATION_APPLICATION_SELECT)
    .eq('user_id', userId)
    .eq('application_batch_id', batchId)
    .eq('result', 'APPLIED')
    .limit(500)
  assertNoError(appError)

  let conflicts = 0
  for (const application of (applications ?? []) as AutomationApplication[]) {
    if (!application.transaction_id) continue
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select(AUTOMATION_TX_SELECT)
      .eq('user_id', userId)
      .eq('id', application.transaction_id)
      .maybeSingle()
    assertNoError(txError)
    if (!transaction) {
      conflicts += 1
      continue
    }

    const current = transaction as AutomationTransaction
    const stillMatches = Object.entries(application.applied_values).every(([field, value]) => current[field as keyof AutomationTransaction] === value)
    if (!stillMatches) {
      conflicts += 1
      continue
    }

    const previous = application.previous_values
    const { error } = await supabase.rpc('update_transaction_atomic', {
      p_transaction_id: current.id,
      p_account_id: previous.account_id ?? null,
      p_type: previous.type ?? null,
      p_amount: null,
      p_date: null,
      p_description: previous.description ?? null,
      p_category_id: Object.prototype.hasOwnProperty.call(previous, 'category_id') ? previous.category_id : null,
      p_notes: previous.notes ?? null,
      p_destination_account_id: null,
      p_clear_category: Object.prototype.hasOwnProperty.call(previous, 'category_id') && previous.category_id === null,
    })
    if (error) {
      conflicts += 1
      continue
    }
    await supabase
      .from('automation_rule_applications')
      .update({ result: 'REVERTED', reverted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('id', application.id)
  }

  const { data: updated, error: updateError } = await supabase
    .from('automation_application_batches')
    .update({ status: conflicts > 0 ? 'REVERT_CONFLICT' : 'REVERTED', reverted_at: new Date().toISOString(), conflict_count: conflicts })
    .eq('user_id', userId)
    .eq('id', batchId)
    .select(AUTOMATION_BATCH_SELECT)
    .single()
  assertNoError(updateError, 'REVERT_FAILED')
  return updated as AutomationBatch
}
