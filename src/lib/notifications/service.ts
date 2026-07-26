import type { SupabaseClient } from '@supabase/supabase-js'
import { evaluateNotificationRules } from './engine'
import { NOTIFICATION_META, NOTIFICATIONS_BELL_LIMIT, NOTIFICATIONS_DEFAULT_LIMIT, NOTIFICATIONS_PAGE_LIMIT, REFRESH_COOLDOWN_SECONDS } from './constants'
import type {
  EngineInput,
  Notification,
  NotificationCandidate,
  NotificationListParams,
  NotificationListResult,
  RefreshResult,
  UpsertResult,
} from './types'

// ── Cooldown ─────────────────────────────────────────────────────────────────

/**
 * Returns true if the user is still within the refresh cooldown period.
 * If not in cooldown, records the new refresh time and returns false.
 */
export async function checkAndSetCooldown(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('notification_refresh_cooldowns')
    .select('last_refresh_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (data) {
    const last    = new Date(data.last_refresh_at)
    const elapsed = (Date.now() - last.getTime()) / 1000
    if (elapsed < REFRESH_COOLDOWN_SECONDS) return true
  }

  await supabase
    .from('notification_refresh_cooldowns')
    .upsert({ user_id: userId, last_refresh_at: new Date().toISOString(), updated_at: new Date().toISOString() })

  return false
}

// ── Upsert ────────────────────────────────────────────────────────────────────

/**
 * Upserts notification candidates to the DB.
 * Creates new, updates existing, reopens RESOLVED condition notifications.
 * Never modifies ARCHIVED notifications status.
 */
export async function upsertNotifications(
  supabase: SupabaseClient,
  userId: string,
  candidates: NotificationCandidate[],
): Promise<UpsertResult> {
  if (candidates.length === 0) return { created: 0, updated: 0, reopened: 0 }

  const dedupeKeys = candidates.map((c) => c.dedupeKey)

  // Load existing notifications for matching dedupe keys
  const { data: existing } = await supabase
    .from('notifications')
    .select('id, dedupe_key, severity, title, message, metadata, resolved_at, archived_at')
    .eq('user_id', userId)
    .in('dedupe_key', dedupeKeys)

  const existingMap = new Map<string, typeof existing extends (infer T)[] | null ? T : never>(
    (existing ?? []).map((n) => [n.dedupe_key, n]),
  )

  let created  = 0
  let updated  = 0
  let reopened = 0
  const now    = new Date().toISOString()

  const toCreate: Record<string, unknown>[] = []
  const toUpdate: { id: string; patch: Record<string, unknown> }[] = []

  for (const c of candidates) {
    const existing = existingMap.get(c.dedupeKey)

    if (!existing) {
      toCreate.push({
        user_id:           userId,
        type:              c.type,
        severity:          c.severity,
        title:             c.title,
        message:           c.message,
        dedupe_key:        c.dedupeKey,
        source_type:       c.sourceType,
        source_id:         c.sourceId,
        source_url:        c.sourceUrl,
        metadata:          c.metadata,
        is_read:           false,
        archived_at:       null,
        resolved_at:       null,
        first_detected_at: now,
        last_detected_at:  now,
        created_at:        now,
        updated_at:        now,
      })
      created++
    } else {
      const patch: Record<string, unknown> = {
        last_detected_at: now,
        updated_at:       now,
        // Always refresh content in case values changed
        severity:  c.severity,
        title:     c.title,
        message:   c.message,
        metadata:  c.metadata,
        source_url: c.sourceUrl,
      }
      // Reopen RESOLVED condition notifications when condition recurs
      if (existing.resolved_at && NOTIFICATION_META[c.type]?.isCondition) {
        patch.resolved_at = null
        patch.is_read     = false
        reopened++
      } else {
        updated++
      }
      toUpdate.push({ id: existing.id, patch })
    }
  }

  // Batch create
  if (toCreate.length > 0) {
    await supabase.from('notifications').insert(toCreate)
  }

  // Batch update (individually — Supabase JS doesn't support batch updates)
  for (const { id, patch } of toUpdate) {
    await supabase.from('notifications').update(patch).eq('id', id).eq('user_id', userId)
  }

  return { created, updated, reopened }
}

// ── Resolution ────────────────────────────────────────────────────────────────

/**
 * Resolves condition notifications that are no longer present in the active candidates.
 * EVENT notifications (isCondition=false) are never auto-resolved.
 */
export async function resolveStaleConditionNotifications(
  supabase: SupabaseClient,
  userId: string,
  activeDedupeKeys: string[],
): Promise<number> {
  const now = new Date().toISOString()

  // Find all active condition-type notifications for this user
  const conditionTypes = Object.entries(NOTIFICATION_META)
    .filter(([, m]) => m.isCondition)
    .map(([t]) => t)

  const { data: activeNotifications } = await supabase
    .from('notifications')
    .select('id, dedupe_key')
    .eq('user_id', userId)
    .in('type', conditionTypes)
    .is('resolved_at', null)
    .is('archived_at', null)

  if (!activeNotifications || activeNotifications.length === 0) return 0

  const toResolve = activeNotifications
    .filter((n) => !activeDedupeKeys.includes(n.dedupe_key))
    .map((n) => n.id)

  if (toResolve.length === 0) return 0

  await supabase
    .from('notifications')
    .update({ resolved_at: now, updated_at: now })
    .eq('user_id', userId)
    .in('id', toResolve)

  return toResolve.length
}

// ── Full refresh ──────────────────────────────────────────────────────────────

export async function runFullRefresh(
  supabase: SupabaseClient,
  userId: string,
  input: EngineInput,
): Promise<RefreshResult> {
  const startMs = Date.now()

  const candidates  = evaluateNotificationRules(input)
  const upsertResult = await upsertNotifications(supabase, userId, candidates)

  const conditionKeys = candidates
    .filter((c) => NOTIFICATION_META[c.type]?.isCondition)
    .map((c) => c.dedupeKey)

  const conditionNotificationsResolved = await resolveStaleConditionNotifications(
    supabase, userId, conditionKeys,
  )

  return {
    candidatesGenerated: candidates.length,
    upsertResult,
    conditionNotificationsResolved,
    durationMs: Date.now() - startMs,
  }
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function listNotifications(
  supabase: SupabaseClient,
  userId: string,
  params: NotificationListParams,
): Promise<NotificationListResult> {
  const limit  = Math.min(params.limit ?? NOTIFICATIONS_DEFAULT_LIMIT, NOTIFICATIONS_PAGE_LIMIT)
  const offset = (params.page - 1) * limit

  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)

  // Status filter
  switch (params.status) {
    case 'unread':
      query = query.eq('is_read', false).is('archived_at', null).is('resolved_at', null)
      break
    case 'read':
      query = query.eq('is_read', true).is('archived_at', null).is('resolved_at', null)
      break
    case 'archived':
      query = query.not('archived_at', 'is', null)
      break
    case 'resolved':
      query = query.not('resolved_at', 'is', null)
      break
    // 'all': no extra filter
  }

  if (params.severity) query = query.eq('severity', params.severity)
  if (params.type)     query = query.eq('type', params.type)
  if (params.sourceType) query = query.eq('source_type', params.sourceType)

  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .is('archived_at', null)
    .is('resolved_at', null)

  return {
    data: (data ?? []) as Notification[],
    total: count ?? 0,
    unreadCount: unreadCount ?? 0,
    page: params.page,
    limit,
  }
}

// ── Bell dropdown ─────────────────────────────────────────────────────────────

export async function getRecentUnread(
  supabase: SupabaseClient,
  userId: string,
  limit = NOTIFICATIONS_BELL_LIMIT,
): Promise<{ notifications: Notification[]; unreadCount: number }> {
  const [{ data }, { count }] = await Promise.all([
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .is('archived_at', null)
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
      .is('archived_at', null)
      .is('resolved_at', null),
  ])

  return {
    notifications: (data ?? []) as Notification[],
    unreadCount:   count ?? 0,
  }
}

// ── State mutations ───────────────────────────────────────────────────────────

export async function markAsRead(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<boolean> {
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: now, updated_at: now })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()
  return data !== null
}

export async function markAsUnread(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<boolean> {
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('notifications')
    .update({ is_read: false, read_at: null, updated_at: now })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()
  return data !== null
}

export async function markAllAsRead(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: now, updated_at: now })
    .eq('user_id', userId)
    .eq('is_read', false)
    .is('archived_at', null)
    .is('resolved_at', null)
    .select('id')
  return (data ?? []).length
}

export async function archiveNotification(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<boolean> {
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('notifications')
    .update({ archived_at: now, updated_at: now })
    .eq('id', id)
    .eq('user_id', userId)
    .is('archived_at', null)
    .select('id')
    .maybeSingle()
  return data !== null
}

export async function restoreFromArchive(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<boolean> {
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('notifications')
    .update({ archived_at: null, updated_at: now })
    .eq('id', id)
    .eq('user_id', userId)
    .not('archived_at', 'is', null)
    .select('id')
    .maybeSingle()
  return data !== null
}

export async function resolveNotification(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<boolean> {
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('notifications')
    .update({ resolved_at: now, updated_at: now })
    .eq('id', id)
    .eq('user_id', userId)
    .is('resolved_at', null)
    .select('id')
    .maybeSingle()
  return data !== null
}

// ── Data loading helpers (called by the refresh endpoint) ─────────────────────

export async function loadEngineInput(
  supabase: SupabaseClient,
  userId: string,
  now: Date,
): Promise<EngineInput> {
  const automationWindowDays = 30
  const automationCutoff     = new Date(now.getTime() - automationWindowDays * 86_400_000).toISOString()
  const duplicateCutoff      = new Date(now.getTime() - 14 * 86_400_000).toISOString().slice(0, 10)

  const [
    { data: accounts },
    { data: budgetsRaw },
    { data: recurringRules },
    { data: goals },
    { data: loans },
    { data: loanPayments },
    { data: automationApplications },
    { data: recentTransactions },
  ] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', userId).eq('is_active', true),
    supabase.from('budgets')
      .select('id, category_id, amount, month, year, categories(name)')
      .eq('user_id', userId)
      .eq('year', now.getFullYear())
      .eq('month', now.getMonth() + 1),
    supabase.from('recurring_rules').select('*').eq('user_id', userId).eq('is_active', true),
    supabase.from('savings_goals').select('*').eq('user_id', userId).eq('archived', false),
    supabase.from('loans').select('*').eq('user_id', userId).eq('is_settled', false),
    supabase.from('loan_payments').select('*').eq('user_id', userId),
    supabase
      .from('automation_rule_applications')
      .select('id, rule_id, transaction_id, application_batch_id, result, error_code, applied_at, applied_values')
      .eq('user_id', userId)
      .in('result', ['FAILED', 'CONFLICT'])
      .gte('applied_at', automationCutoff)
      .order('applied_at', { ascending: false })
      .limit(50),
    supabase
      .from('transactions')
      .select('id, account_id, type, amount, description, date, transfer_peer_id')
      .eq('user_id', userId)
      .gte('date', duplicateCutoff)
      .is('transfer_peer_id', null)
      .neq('type', 'transfer')
      .order('date', { ascending: false })
      .limit(200),
  ])

  // Compute budget entries with spent amounts in a separate query (simpler than a join)
  const budgetIds = (budgetsRaw ?? []).map((b) => b.id)
  let budgetEntries: import('@/lib/budgets/service').BudgetEntry[] = []
  if (budgetIds.length > 0) {
    const { listMonthlyBudgets } = await import('@/lib/budgets/service')
    budgetEntries = await listMonthlyBudgets(supabase, now.getFullYear(), now.getMonth() + 1)
  }

  return {
    userId,
    now,
    accounts:                    (accounts ?? []) as unknown as import('@/types/database').Account[],
    budgets:                     budgetEntries,
    recurringRules:              (recurringRules ?? []) as import('@/types/database').RecurringRule[],
    goals:                       (goals ?? []) as import('@/types/database').SavingsGoal[],
    loans:                       (loans ?? []) as import('@/types/database').Loan[],
    recentLoanPayments:          (loanPayments ?? []) as import('@/types/database').LoanPayment[],
    recentAutomationApplications: (automationApplications ?? []) as import('@/types/database').AutomationRuleApplication[],
    recentTransactions:          (recentTransactions ?? []) as import('@/types/database').Transaction[],
  }
}
