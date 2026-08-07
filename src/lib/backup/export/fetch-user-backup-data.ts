import type { SupabaseClient } from '@supabase/supabase-js'
import { canAccessPrivateFinance, canAccessPrivateHr } from '@/lib/access/private-finance-access'

import type {
  Account,
  AuditLog,
  AutomationApplicationBatch,
  AutomationRule,
  AutomationRuleApplication,
  Birthday,
  BirthdayReminderLog,
  Budget,
  Category,
  Database,
  DataIntegrityIssueRecord,
  DependentBeneficiary,
  AccountPurposeLink,
  AdiEntry,
  FinanceTransferMetadata,
  FinancialHealthSnapshot,
  LeaveEntry,
  LeaveSettings,
  Loan,
  LoanPayment,
  Profile,
  RecurringRule,
  Transaction,
} from '@/types/database'
import type { Notification } from '@/lib/notifications/types'
import type {
  NotificationPreference,
  NotificationSourceMute,
  NotificationUserSettings,
} from '@/lib/notifications/preferences-types'

export const BACKUP_PROFILE_SELECT =
  'id,display_name,avatar_url,currency,locale,timezone,onboarding_done,created_at,updated_at'
export const BACKUP_ACCOUNT_SELECT =
  'id,user_id,name,type,color,icon,balance,currency,is_active,is_hidden,sort_order,created_at,updated_at'
export const BACKUP_CATEGORY_SELECT =
  'id,user_id,name,type,color,icon,parent_id,is_default,sort_order,created_at'
export const BACKUP_TRANSACTION_SELECT =
  'id,user_id,account_id,category_id,type,amount,description,notes,date,transfer_peer_id,recurring_id,receipt_url,receipt_data,created_at,updated_at'
export const BACKUP_BUDGET_SELECT =
  'id,user_id,category_id,amount,month,year,created_at,updated_at'
export const BACKUP_RECURRING_RULE_SELECT =
  'id,user_id,account_id,category_id,type,amount,description,frequency,start_date,end_date,next_due_date,last_run_date,is_active,auto_create,created_at,updated_at'
export const BACKUP_LOAN_SELECT =
  'id,user_id,counterpart,type,amount,remaining,description,due_date,is_settled,settled_at,created_at,updated_at'
export const BACKUP_LOAN_PAYMENT_SELECT =
  'id,loan_id,user_id,amount,paid_at,notes,created_at'
export const BACKUP_BIRTHDAY_SELECT =
  'id,user_id,name,birth_date,reminder_days,notes,created_at,updated_at'
export const BACKUP_BIRTHDAY_REMINDER_LOG_SELECT =
  'id,birthday_id,user_id,days_before,year,sent_at'
export const BACKUP_AUDIT_LOG_SELECT =
  'id,user_id,action,table_name,record_id,old_data,new_data,created_at'
export const BACKUP_AUTOMATION_RULE_SELECT =
  'id,user_id,name,description,is_active,priority,match_mode,stop_processing,apply_to_new_transactions,archived,conditions,actions,created_at,updated_at'
export const BACKUP_AUTOMATION_BATCH_SELECT =
  'id,user_id,rule_id,mode,status,transaction_count,applied_count,skipped_count,conflict_count,failed_count,created_at,reverted_at'
export const BACKUP_AUTOMATION_APPLICATION_SELECT =
  'id,user_id,rule_id,transaction_id,application_batch_id,application_mode,previous_values,applied_values,result,error_code,applied_at,reverted_at'
export const BACKUP_FINANCIAL_HEALTH_SNAPSHOT_SELECT =
  'id,user_id,period_key,period_start,period_end,total_score,level,is_provisional,data_quality,observed_weight,metrics,component_scores,factors,recommendations,calculation_version,calculated_at,created_at,updated_at'
export const BACKUP_DASHBOARD_PREFERENCES_SELECT =
  'user_id,visible_widgets,widget_order,compact_mode,default_period,created_at,updated_at'
export const BACKUP_DATA_INTEGRITY_ISSUE_SELECT =
  'fingerprint,rule_code,status,ignored_reason,acknowledged_at,ignored_at,resolved_at,ruleset_version,updated_at'
export const BACKUP_FINANCIAL_SCENARIO_SELECT =
  'id,user_id,name,description,status,horizon_months,start_date,end_date,currency,actions,assumptions,engine_version,schema_version,action_registry_version,baseline_as_of,last_calculated_at,result_summary,is_favorite,created_at,updated_at'
export const BACKUP_DEPENDENT_BENEFICIARY_SELECT =
  'id,user_id,name,relationship,notes,created_at,updated_at'
export const BACKUP_ACCOUNT_PURPOSE_LINK_SELECT =
  'id,user_id,account_id,beneficiary_id,purpose,label,created_at,updated_at'
export const BACKUP_FINANCE_TRANSFER_METADATA_SELECT =
  'id,user_id,source_transaction_id,destination_transaction_id,source_scope,destination_scope,reason,note,idempotency_key,created_at,updated_at'
export const BACKUP_ADI_ENTRY_SELECT =
  'id,user_id,transaction_id,entry_type,adi_category,amount,date,reference_period,description,note,funding_source,created_at,updated_at'
export const BACKUP_LEAVE_SETTINGS_SELECT =
  'id,user_id,vacation_days_per_year,permit_104_hours_per_month,timezone,created_at,updated_at'
export const BACKUP_LEAVE_ENTRY_SELECT =
  'id,user_id,type,start_date,end_date,days,hours,start_time,end_time,note,created_at,updated_at'

export type BackupAuthenticatedUser = {
  id: string
  email?: string | null
}

export type UserBackupData = {
  user: BackupAuthenticatedUser
  profile: Profile | null
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  budgets: Budget[]
  recurringRules: RecurringRule[]
  loans: Loan[]
  loanPayments: LoanPayment[]
  birthdays: Birthday[]
  birthdayReminderLog: BirthdayReminderLog[]
  auditLogs: AuditLog[]
  automationRules?: AutomationRule[]
  automationApplicationBatches?: AutomationApplicationBatch[]
  automationRuleApplications?: AutomationRuleApplication[]
  // Notifications: export-only since Sprint 13A; restore is deferred
  notifications?: Notification[]
  // Notification preferences: export-only since Sprint 13B; restore is deferred
  notificationUserSettings?: NotificationUserSettings | null
  notificationPreferences?: NotificationPreference[]
  notificationSourceMutes?: NotificationSourceMute[]
  // Financial health snapshots: export-only since Sprint 14A; restore is deferred
  financialHealthSnapshots?: FinancialHealthSnapshot[]
  dashboardPreferences?: {
    visible_widgets: string[]
    widget_order: string[]
    compact_mode: boolean
    default_period: string
    created_at?: string
    updated_at?: string
  } | null
  dataIntegrityIssues?: Pick<DataIntegrityIssueRecord, 'fingerprint' | 'rule_code' | 'status' | 'ignored_reason' | 'acknowledged_at' | 'ignored_at' | 'resolved_at' | 'ruleset_version' | 'updated_at'>[]
  // Financial scenarios: export-only (restore deferred)
  financialScenarios?: Record<string, unknown>[]
  dependentBeneficiaries?: DependentBeneficiary[]
  accountPurposeLinks?: AccountPurposeLink[]
  financeTransferMetadata?: FinanceTransferMetadata[]
  adiEntries?: AdiEntry[]
  leaveSettings?: LeaveSettings[]
  leaveEntries?: LeaveEntry[]
}

type BackupSupabaseClient = SupabaseClient<Database>
type QueryResult<T> = { data: T[] | null; error: { message: string } | null }
type SingleQueryResult<T> = { data: T | null; error: { message: string } | null }

export class BackupExportDataError extends Error {
  constructor(
    public readonly entity: string,
    message: string,
  ) {
    super(`Backup export data error for ${entity}: ${message}`)
    this.name = 'BackupExportDataError'
  }
}

export async function getAuthenticatedBackupUser(
  supabase: BackupSupabaseClient,
): Promise<BackupAuthenticatedUser | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    throw new BackupExportDataError('auth', error.message)
  }

  return user ? { id: user.id, email: user.email ?? null } : null
}

export async function fetchUserBackupData(
  supabase: BackupSupabaseClient,
  user: BackupAuthenticatedUser,
): Promise<UserBackupData> {
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
    automationRules,
    automationApplicationBatches,
    automationRuleApplications,
    notifications,
    notificationUserSettings,
    notificationPreferences,
    notificationSourceMutes,
    financialHealthSnapshots,
    dashboardPreferences,
    dataIntegrityIssues,
    financialScenarios,
    dependentBeneficiaries,
    accountPurposeLinks,
    financeTransferMetadata,
    adiEntries,
    leaveSettings,
    leaveEntries,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select(BACKUP_PROFILE_SELECT)
      .eq('id', user.id)
      .maybeSingle() as unknown as Promise<SingleQueryResult<Profile>>,
    supabase
      .from('accounts')
      .select(BACKUP_ACCOUNT_SELECT)
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }) as unknown as Promise<QueryResult<Account>>,
    supabase
      .from('categories')
      .select(BACKUP_CATEGORY_SELECT)
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }) as unknown as Promise<QueryResult<Category>>,
    supabase
      .from('transactions')
      .select(BACKUP_TRANSACTION_SELECT)
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true }) as unknown as Promise<QueryResult<Transaction>>,
    supabase
      .from('budgets')
      .select(BACKUP_BUDGET_SELECT)
      .eq('user_id', user.id)
      .order('year', { ascending: true })
      .order('month', { ascending: true }) as unknown as Promise<QueryResult<Budget>>,
    supabase
      .from('recurring_rules')
      .select(BACKUP_RECURRING_RULE_SELECT)
      .eq('user_id', user.id)
      .order('next_due_date', { ascending: true }) as unknown as Promise<QueryResult<RecurringRule>>,
    supabase
      .from('loans')
      .select(BACKUP_LOAN_SELECT)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }) as unknown as Promise<QueryResult<Loan>>,
    supabase
      .from('loan_payments')
      .select(BACKUP_LOAN_PAYMENT_SELECT)
      .eq('user_id', user.id)
      .order('paid_at', { ascending: true }) as unknown as Promise<QueryResult<LoanPayment>>,
    supabase
      .from('birthdays')
      .select(BACKUP_BIRTHDAY_SELECT)
      .eq('user_id', user.id)
      .order('birth_date', { ascending: true }) as unknown as Promise<QueryResult<Birthday>>,
    supabase
      .from('birthday_reminder_log')
      .select(BACKUP_BIRTHDAY_REMINDER_LOG_SELECT)
      .eq('user_id', user.id)
      .order('sent_at', { ascending: true }) as unknown as Promise<QueryResult<BirthdayReminderLog>>,
    supabase
      .from('audit_logs')
      .select(BACKUP_AUDIT_LOG_SELECT)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }) as unknown as Promise<QueryResult<AuditLog>>,
    (supabase as unknown as SupabaseClient)
      .from('automation_rules')
      .select(BACKUP_AUTOMATION_RULE_SELECT)
      .eq('user_id', user.id)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true }) as unknown as Promise<QueryResult<AutomationRule>>,
    (supabase as unknown as SupabaseClient)
      .from('automation_application_batches')
      .select(BACKUP_AUTOMATION_BATCH_SELECT)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }) as unknown as Promise<QueryResult<AutomationApplicationBatch>>,
    (supabase as unknown as SupabaseClient)
      .from('automation_rule_applications')
      .select(BACKUP_AUTOMATION_APPLICATION_SELECT)
      .eq('user_id', user.id)
      .order('applied_at', { ascending: true }) as unknown as Promise<QueryResult<AutomationRuleApplication>>,
    // Notifications: export-only (restore deferred). Limit to 5000 to cap backup size.
    (supabase as unknown as SupabaseClient)
      .from('notifications')
      .select('id, type, severity, title, message, dedupe_key, source_type, source_id, source_url, metadata, is_read, archived_at, resolved_at, first_detected_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5000) as unknown as Promise<QueryResult<Notification>>,
    // Notification preferences: export-only since Sprint 13B; restore deferred
    (supabase as unknown as SupabaseClient)
      .from('notification_user_settings')
      .select('notifications_enabled,show_info,show_warning,show_critical,quiet_hours_enabled,quiet_hours_start,quiet_hours_end,timezone,digest_enabled,digest_frequency,digest_time,created_at,updated_at')
      .eq('user_id', user.id)
      .maybeSingle() as unknown as Promise<SingleQueryResult<NotificationUserSettings>>,
    (supabase as unknown as SupabaseClient)
      .from('notification_preferences')
      .select('id,notification_type,is_enabled,config,created_at,updated_at')
      .eq('user_id', user.id)
      .order('notification_type', { ascending: true }) as unknown as Promise<QueryResult<NotificationPreference>>,
    (supabase as unknown as SupabaseClient)
      .from('notification_source_mutes')
      .select('id,source_type,source_id,notification_type,muted_until,reason,created_at,updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }) as unknown as Promise<QueryResult<NotificationSourceMute>>,
    (supabase as unknown as SupabaseClient)
      .from('financial_health_snapshots')
      .select(BACKUP_FINANCIAL_HEALTH_SNAPSHOT_SELECT)
      .eq('user_id', user.id)
      .order('period_start', { ascending: true }) as unknown as Promise<QueryResult<FinancialHealthSnapshot>>,
    (supabase as unknown as SupabaseClient)
      .from('dashboard_preferences')
      .select(BACKUP_DASHBOARD_PREFERENCES_SELECT)
      .eq('user_id', user.id)
      .maybeSingle() as unknown as Promise<SingleQueryResult<NonNullable<UserBackupData['dashboardPreferences']>>>,
    (supabase as unknown as SupabaseClient)
      .from('data_integrity_issues')
      .select(BACKUP_DATA_INTEGRITY_ISSUE_SELECT)
      .eq('user_id', user.id)
      .in('status', ['ignored', 'acknowledged'])
      .limit(5000) as unknown as Promise<QueryResult<NonNullable<UserBackupData['dataIntegrityIssues']>[number]>>,
    // Financial scenarios: export-only (non-fatal for forward compatibility)
    (supabase as unknown as SupabaseClient)
      .from('financial_scenarios')
      .select(BACKUP_FINANCIAL_SCENARIO_SELECT)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(500) as unknown as Promise<QueryResult<Record<string, unknown>>>,
    (supabase as unknown as SupabaseClient)
      .from('dependent_beneficiaries')
      .select(BACKUP_DEPENDENT_BENEFICIARY_SELECT)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }) as unknown as Promise<QueryResult<DependentBeneficiary>>,
    (supabase as unknown as SupabaseClient)
      .from('account_purpose_links')
      .select(BACKUP_ACCOUNT_PURPOSE_LINK_SELECT)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }) as unknown as Promise<QueryResult<AccountPurposeLink>>,
    (supabase as unknown as SupabaseClient)
      .from('finance_transfer_metadata')
      .select(BACKUP_FINANCE_TRANSFER_METADATA_SELECT)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }) as unknown as Promise<QueryResult<FinanceTransferMetadata>>,
    (supabase as unknown as SupabaseClient)
      .from('adi_entries')
      .select(BACKUP_ADI_ENTRY_SELECT)
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true }) as unknown as Promise<QueryResult<AdiEntry>>,
    (supabase as unknown as SupabaseClient)
      .from('leave_settings')
      .select(BACKUP_LEAVE_SETTINGS_SELECT)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }) as unknown as Promise<QueryResult<LeaveSettings>>,
    (supabase as unknown as SupabaseClient)
      .from('leave_entries')
      .select(BACKUP_LEAVE_ENTRY_SELECT)
      .eq('user_id', user.id)
      .order('start_date', { ascending: true })
      .order('created_at', { ascending: true }) as unknown as Promise<QueryResult<LeaveEntry>>,
  ])

  assertNoQueryError('profiles', profile.error)
  assertNoQueryError('accounts', accounts.error)
  assertNoQueryError('categories', categories.error)
  assertNoQueryError('transactions', transactions.error)
  assertNoQueryError('budgets', budgets.error)
  assertNoQueryError('recurring_rules', recurringRules.error)
  assertNoQueryError('loans', loans.error)
  assertNoQueryError('loan_payments', loanPayments.error)
  assertNoQueryError('birthdays', birthdays.error)
  assertNoQueryError('birthday_reminder_log', birthdayReminderLog.error)
  assertNoQueryError('audit_logs', auditLogs.error)
  assertNoQueryError('automation_rules', automationRules.error)
  assertNoQueryError('automation_application_batches', automationApplicationBatches.error)
  assertNoQueryError('automation_rule_applications', automationRuleApplications.error)
  // Notifications errors are non-fatal: backup proceeds even if the table is missing
  // (e.g., before migration 00020 is applied to production)
  // Financial health snapshot errors are non-fatal for the same compatibility reason.

  const rawData: UserBackupData = {
    user,
    profile: profile.data,
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
    automationRules: automationRules.data ?? [],
    automationApplicationBatches: automationApplicationBatches.data ?? [],
    automationRuleApplications: automationRuleApplications.data ?? [],
    notifications: notifications.error ? [] : (notifications.data ?? []),
    // Notification preferences are non-fatal: backup proceeds even if tables are missing
    notificationUserSettings: notificationUserSettings.error ? null : notificationUserSettings.data,
    notificationPreferences: notificationPreferences.error ? [] : (notificationPreferences.data ?? []),
    notificationSourceMutes: notificationSourceMutes.error ? [] : (notificationSourceMutes.data ?? []),
    financialHealthSnapshots: financialHealthSnapshots.error ? [] : (financialHealthSnapshots.data ?? []),
    dashboardPreferences: dashboardPreferences.error ? null : dashboardPreferences.data,
    dataIntegrityIssues: dataIntegrityIssues.error ? [] : (dataIntegrityIssues.data ?? []),
    financialScenarios: financialScenarios.error ? [] : (financialScenarios.data ?? []),
    dependentBeneficiaries: dependentBeneficiaries.error ? [] : (dependentBeneficiaries.data ?? []),
    accountPurposeLinks: accountPurposeLinks.error ? [] : (accountPurposeLinks.data ?? []),
    financeTransferMetadata: financeTransferMetadata.error ? [] : (financeTransferMetadata.data ?? []),
    adiEntries: adiEntries.error ? [] : (adiEntries.data ?? []),
    leaveSettings: canAccessPrivateHr(user.email) && !leaveSettings.error ? (leaveSettings.data ?? []) : [],
    leaveEntries: canAccessPrivateHr(user.email) && !leaveEntries.error ? (leaveEntries.data ?? []) : [],
  }

  if (canAccessPrivateFinance(user.email)) return rawData

  const privateAccountIds = new Set((rawData.accountPurposeLinks ?? [])
    .filter((link) => link.purpose === 'DEPENDENT_AURORA' || link.purpose === 'DEPENDENT' || link.purpose === 'ADI')
    .map((link) => link.account_id))

  return {
    ...rawData,
    accounts: rawData.accounts.filter((account) => !privateAccountIds.has(account.id)),
    transactions: rawData.transactions.filter((transaction) => !privateAccountIds.has(transaction.account_id)),
    recurringRules: rawData.recurringRules.filter((rule) => !privateAccountIds.has(rule.account_id)),
    dependentBeneficiaries: [],
    accountPurposeLinks: [],
    financeTransferMetadata: [],
    adiEntries: [],
  }
}

function assertNoQueryError(entity: string, error: { message: string } | null): void {
  if (error) {
    throw new BackupExportDataError(entity, error.message)
  }
}
