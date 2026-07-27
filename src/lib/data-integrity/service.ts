import type { SupabaseClient } from '@supabase/supabase-js'
import { scanDataIntegrity, sortIssues, summarizeIssues } from './engine'
import type { DataIntegrityInput, DataIntegrityIssue, DataIntegrityIssueRow, DataIntegrityScanMode, DataIntegrityScanResult, DataIntegrityScanRunRow, DataIntegrityStatus } from './types'

type DataIntegritySupabase = SupabaseClient
type QueryResult<T> = { data: T[] | null; error: { message: string; code?: string } | null }
type SingleResult<T> = { data: T | null; error: { message: string; code?: string } | null }

export class DataIntegrityError extends Error {
  constructor(
    public readonly code: 'DATASET_TOO_LARGE' | 'FETCH_FAILED' | 'SCAN_FAILED' | 'ISSUE_NOT_FOUND' | 'INVALID_STATUS' | 'PERSISTENCE_UNAVAILABLE',
    message: string,
  ) {
    super(message)
    this.name = 'DataIntegrityError'
  }
}

export async function fetchDataIntegrityInput(supabase: DataIntegritySupabase, userId: string): Promise<DataIntegrityInput> {
  const [
    accounts,
    categories,
    transactions,
    recurringRules,
    budgets,
    goals,
    goalContributions,
    loans,
    loanPayments,
    notifications,
    financialHealthSnapshots,
  ] = await Promise.all([
    supabase.from('accounts').select('id,user_id,name,type,color,icon,balance,currency,is_active,is_hidden,sort_order,created_at,updated_at').eq('user_id', userId) as unknown as Promise<QueryResult<DataIntegrityInput['accounts'][number]>>,
    supabase.from('categories').select('id,user_id,name,type,color,icon,parent_id,is_default,sort_order,created_at').eq('user_id', userId) as unknown as Promise<QueryResult<DataIntegrityInput['categories'][number]>>,
    supabase.from('transactions').select('id,user_id,account_id,category_id,type,amount,description,notes,date,transfer_peer_id,recurring_id,receipt_url,receipt_data,created_at,updated_at').eq('user_id', userId).order('date', { ascending: false }).limit(100000) as unknown as Promise<QueryResult<DataIntegrityInput['transactions'][number]>>,
    supabase.from('recurring_rules').select('id,user_id,account_id,category_id,type,amount,description,frequency,start_date,end_date,next_due_date,last_run_date,is_active,auto_create,created_at,updated_at').eq('user_id', userId) as unknown as Promise<QueryResult<DataIntegrityInput['recurringRules'][number]>>,
    supabase.from('budgets').select('id,user_id,category_id,amount,month,year,created_at,updated_at').eq('user_id', userId) as unknown as Promise<QueryResult<DataIntegrityInput['budgets'][number]>>,
    supabase.from('savings_goals').select('id,user_id,name,target_amount,current_amount,target_date,icon,color,notes,status,archived,created_at,updated_at').eq('user_id', userId) as unknown as Promise<QueryResult<DataIntegrityInput['goals'][number]>>,
    supabase.from('goal_contributions').select('id,goal_id,user_id,amount,date,note,created_at').eq('user_id', userId) as unknown as Promise<QueryResult<DataIntegrityInput['goalContributions'][number]>>,
    supabase.from('loans').select('id,user_id,counterpart,type,amount,remaining,description,due_date,is_settled,settled_at,created_at,updated_at').eq('user_id', userId) as unknown as Promise<QueryResult<DataIntegrityInput['loans'][number]>>,
    supabase.from('loan_payments').select('id,loan_id,user_id,amount,paid_at,notes,created_at').eq('user_id', userId) as unknown as Promise<QueryResult<DataIntegrityInput['loanPayments'][number]>>,
    (supabase as unknown as SupabaseClient).from('notifications').select('id,user_id,type,severity,title,message,dedupe_key,source_type,source_id,source_url,metadata,is_read,archived_at,resolved_at,snoozed_until,first_detected_at,last_detected_at,created_at,updated_at').eq('user_id', userId).limit(5000) as unknown as Promise<QueryResult<DataIntegrityInput['notifications'][number]>>,
    supabase.from('financial_health_snapshots').select('id,user_id,period_key,period_start,period_end,total_score,level,is_provisional,data_quality,observed_weight,metrics,component_scores,factors,recommendations,calculation_version,calculated_at,created_at,updated_at').eq('user_id', userId).order('period_start', { ascending: false }).limit(500) as unknown as Promise<QueryResult<DataIntegrityInput['financialHealthSnapshots'][number]>>,
  ])

  const required = [accounts, categories, transactions, recurringRules, budgets, goals, goalContributions, loans, loanPayments]
  if (required.some((result) => result.error)) throw new DataIntegrityError('FETCH_FAILED', 'Impossibile caricare i dati per la scansione.')

  return {
    userId,
    now: new Date().toISOString(),
    accounts: accounts.data ?? [],
    categories: categories.data ?? [],
    transactions: transactions.data ?? [],
    recurringRules: recurringRules.data ?? [],
    budgets: budgets.data ?? [],
    goals: goals.data ?? [],
    goalContributions: goalContributions.data ?? [],
    loans: loans.data ?? [],
    loanPayments: loanPayments.data ?? [],
    notifications: notifications.error ? [] : (notifications.data ?? []),
    financialHealthSnapshots: financialHealthSnapshots.error ? [] : (financialHealthSnapshots.data ?? []),
  }
}

export async function runDataIntegrityScan(supabase: DataIntegritySupabase, userId: string, mode: DataIntegrityScanMode = 'quick'): Promise<DataIntegrityScanResult & { scanRun: DataIntegrityScanRunRow | null }> {
  const input = await fetchDataIntegrityInput(supabase, userId)
  const result = scanDataIntegrity(input, mode)
  const scanRun = await persistScanResult(supabase, userId, result)
  return { ...result, scanRun }
}

export async function listDataIntegrityIssues(supabase: DataIntegritySupabase, userId: string, filters: { status?: string; severity?: string; category?: string; rule?: string; limit?: number } = {}) {
  let query = supabase
    .from('data_integrity_issues')
    .select('*')
    .eq('user_id', userId)
    .order('last_detected_at', { ascending: false })
    .limit(Math.min(Math.max(filters.limit ?? 200, 1), 500))

  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.severity && filters.severity !== 'all') query = query.eq('severity', filters.severity)
  if (filters.category && filters.category !== 'all') query = query.eq('category', filters.category)
  if (filters.rule && filters.rule !== 'all') query = query.eq('rule_code', filters.rule)

  const { data, error } = await query as unknown as QueryResult<DataIntegrityIssueRow>
  if (error) return { issues: [], summary: summarizeIssues([]), persistenceAvailable: false }
  const issues = sortIssues((data ?? []).map(issueFromRow))
  return { issues, summary: summarizeIssues(issues), persistenceAvailable: true }
}

export async function getLatestDataIntegrityScan(supabase: DataIntegritySupabase, userId: string) {
  const { data, error } = await supabase
    .from('data_integrity_scan_runs')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle() as unknown as SingleResult<DataIntegrityScanRunRow>
  return error ? null : data
}

export async function getDataIntegrityIssue(supabase: DataIntegritySupabase, userId: string, issueId: string) {
  const { data, error } = await supabase
    .from('data_integrity_issues')
    .select('*')
    .eq('user_id', userId)
    .eq('id', issueId)
    .maybeSingle() as unknown as SingleResult<DataIntegrityIssueRow>
  if (error || !data) throw new DataIntegrityError('ISSUE_NOT_FOUND', 'Issue non trovata.')
  return issueFromRow(data)
}

export async function updateDataIntegrityIssueStatus(supabase: DataIntegritySupabase, userId: string, issueId: string, status: DataIntegrityStatus, reason?: string | null) {
  if (!['open', 'acknowledged', 'ignored', 'resolved', 'stale'].includes(status)) throw new DataIntegrityError('INVALID_STATUS', 'Stato non valido.')
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    status,
    acknowledged_at: status === 'acknowledged' ? now : null,
    ignored_at: status === 'ignored' ? now : null,
    ignored_reason: status === 'ignored' ? reason ?? null : null,
    resolved_at: status === 'resolved' ? now : null,
  }
  if (status === 'open') {
    patch.acknowledged_at = null
    patch.ignored_at = null
    patch.ignored_reason = null
    patch.resolved_at = null
  }

  const { data, error } = await supabase
    .from('data_integrity_issues')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', issueId)
    .select('*')
    .single() as unknown as SingleResult<DataIntegrityIssueRow>

  if (error || !data) throw new DataIntegrityError('ISSUE_NOT_FOUND', 'Issue non trovata.')
  return issueFromRow(data)
}

async function persistScanResult(supabase: DataIntegritySupabase, userId: string, result: DataIntegrityScanResult) {
  const summary = result.summary
  const { data: runData, error: runError } = await supabase
    .from('data_integrity_scan_runs')
    .insert({
      user_id: userId,
      mode: result.mode,
      status: 'completed',
      ruleset_version: result.rulesetVersion,
      started_at: result.scannedAt,
      completed_at: result.scannedAt,
      detected_count: result.issues.length,
      critical_count: summary.critical,
      warning_count: summary.warning,
      info_count: summary.info,
      metadata: { source: 'manual_scan' },
    })
    .select('*')
    .single() as unknown as SingleResult<DataIntegrityScanRunRow>

  if (runError) return null
  const scanRunId = runData?.id ?? null
  const fingerprints = result.issues.map((issue) => issue.fingerprint)

  const { data: existing } = await supabase
    .from('data_integrity_issues')
    .select('*')
    .eq('user_id', userId)
    .in('fingerprint', fingerprints.length > 0 ? fingerprints : ['__none__']) as unknown as QueryResult<DataIntegrityIssueRow>
  const existingByFingerprint = new Map((existing ?? []).map((row) => [row.fingerprint, row]))

  for (const issue of result.issues) {
    const old = existingByFingerprint.get(issue.fingerprint)
    const nextStatus = old?.status === 'ignored' ? 'ignored' : old?.status === 'acknowledged' ? 'acknowledged' : 'open'
    await supabase.from('data_integrity_issues').upsert({
      user_id: userId,
      fingerprint: issue.fingerprint,
      ruleset_version: issue.rulesetVersion,
      rule_code: issue.ruleCode,
      category: issue.category,
      severity: issue.severity,
      status: nextStatus,
      title: issue.title,
      description: issue.description,
      explanation: issue.explanation,
      impact: issue.impact,
      recommendation: issue.recommendation,
      confidence: issue.confidence,
      entity_type: issue.entityType,
      entity_ids: issue.entityIds,
      evidence: issue.evidence,
      allowed_actions: issue.allowedActions,
      source_path: issue.sourcePath ?? null,
      first_detected_at: old?.first_detected_at ?? result.scannedAt,
      last_detected_at: result.scannedAt,
      resolved_at: null,
      last_scan_run_id: scanRunId,
    }, { onConflict: 'user_id,fingerprint' })
  }

  const { data: currentRows } = await supabase
    .from('data_integrity_issues')
    .select('id,fingerprint,status')
    .eq('user_id', userId)
    .in('status', ['open', 'acknowledged']) as unknown as QueryResult<Pick<DataIntegrityIssueRow, 'id' | 'fingerprint' | 'status'>>

  const activeFingerprints = new Set(fingerprints)
  const resolvedIds = (currentRows ?? []).filter((row) => !activeFingerprints.has(row.fingerprint)).map((row) => row.id)
  if (resolvedIds.length > 0) {
    await supabase
      .from('data_integrity_issues')
      .update({ status: 'resolved', resolved_at: result.scannedAt, last_scan_run_id: scanRunId })
      .eq('user_id', userId)
      .in('id', resolvedIds)
  }

  return runData
}

export function issueFromRow(row: DataIntegrityIssueRow): DataIntegrityIssue {
  return {
    id: row.id,
    userId: row.user_id,
    fingerprint: row.fingerprint,
    rulesetVersion: row.ruleset_version,
    ruleCode: row.rule_code,
    category: row.category,
    severity: row.severity,
    status: row.status,
    title: row.title,
    description: row.description,
    explanation: row.explanation,
    impact: row.impact,
    recommendation: row.recommendation,
    confidence: row.confidence,
    entityType: row.entity_type,
    entityIds: row.entity_ids,
    evidence: row.evidence,
    allowedActions: row.allowed_actions,
    sourcePath: row.source_path ?? undefined,
    firstDetectedAt: row.first_detected_at,
    lastDetectedAt: row.last_detected_at,
  }
}
