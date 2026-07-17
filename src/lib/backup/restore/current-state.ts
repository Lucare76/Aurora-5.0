import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

import { getAuthenticatedBackupUser, type BackupAuthenticatedUser } from '../export/fetch-user-backup-data'
import type { CurrentUserDataSnapshot, SnapshotRecord } from './types'

type BackupSupabaseClient = SupabaseClient<Database>
type QueryResult<T> = { data: T[] | null; error: { message: string } | null }
type SingleQueryResult<T> = { data: T | null; error: { message: string } | null }

export class BackupSnapshotReadError extends Error {
  constructor(
    public readonly entity: string,
    message: string,
  ) {
    super(`Backup snapshot read error for ${entity}: ${message}`)
    this.name = 'BackupSnapshotReadError'
  }
}

export async function getAuthenticatedRestoreUser(
  supabase: BackupSupabaseClient,
): Promise<BackupAuthenticatedUser | null> {
  return getAuthenticatedBackupUser(supabase)
}

export async function fetchCurrentUserDataSnapshot(
  supabase: BackupSupabaseClient,
  user: BackupAuthenticatedUser,
): Promise<CurrentUserDataSnapshot> {
  const [
    profile,
    accounts,
    categories,
    transactions,
    budgets,
    recurringRules,
    loans,
    loanPayments,
    birthdays,
    birthdayReminderLog,
    auditLogs,
  ] = await Promise.all([
    supabase.from('profiles').select('id').eq('id', user.id).maybeSingle() as unknown as Promise<SingleQueryResult<{ id: string }>>,
    supabase.from('accounts').select('id,name,type').eq('user_id', user.id) as unknown as Promise<QueryResult<SnapshotRecord>>,
    supabase.from('categories').select('id,name,type,parent_id,is_default').eq('user_id', user.id) as unknown as Promise<QueryResult<SnapshotRecord>>,
    supabase.from('transactions').select('id,account_id,category_id,amount,date').eq('user_id', user.id) as unknown as Promise<QueryResult<SnapshotRecord>>,
    supabase.from('budgets').select('id,category_id').eq('user_id', user.id) as unknown as Promise<QueryResult<SnapshotRecord>>,
    supabase.from('recurring_rules').select('id,account_id,category_id').eq('user_id', user.id) as unknown as Promise<QueryResult<SnapshotRecord>>,
    supabase.from('loans').select('id').eq('user_id', user.id) as unknown as Promise<QueryResult<SnapshotRecord>>,
    supabase.from('loan_payments').select('id,loan_id,amount,paid_at').eq('user_id', user.id) as unknown as Promise<QueryResult<SnapshotRecord>>,
    supabase.from('birthdays').select('id,name,birth_date').eq('user_id', user.id) as unknown as Promise<QueryResult<SnapshotRecord>>,
    supabase.from('birthday_reminder_log').select('id,birthday_id,days_before,year').eq('user_id', user.id) as unknown as Promise<QueryResult<SnapshotRecord>>,
    supabase.from('audit_logs').select('id').eq('user_id', user.id) as unknown as Promise<QueryResult<SnapshotRecord>>,
  ])

  assertNoSnapshotError('profiles', profile.error)
  assertNoSnapshotError('accounts', accounts.error)
  assertNoSnapshotError('categories', categories.error)
  assertNoSnapshotError('transactions', transactions.error)
  assertNoSnapshotError('budgets', budgets.error)
  assertNoSnapshotError('recurring_rules', recurringRules.error)
  assertNoSnapshotError('loans', loans.error)
  assertNoSnapshotError('loan_payments', loanPayments.error)
  assertNoSnapshotError('birthdays', birthdays.error)
  assertNoSnapshotError('birthday_reminder_log', birthdayReminderLog.error)
  assertNoSnapshotError('audit_logs', auditLogs.error)

  return {
    profileExists: Boolean(profile.data),
    accounts: accounts.data ?? [],
    categories: categories.data ?? [],
    transactions: transactions.data ?? [],
    budgets: budgets.data ?? [],
    recurringRules: recurringRules.data ?? [],
    loans: loans.data ?? [],
    loanPayments: loanPayments.data ?? [],
    birthdays: birthdays.data ?? [],
    birthdayReminderLog: birthdayReminderLog.data ?? [],
    auditLogs: auditLogs.data ?? [],
  }
}

function assertNoSnapshotError(entity: string, error: { message: string } | null): void {
  if (error) {
    throw new BackupSnapshotReadError(entity, error.message)
  }
}
