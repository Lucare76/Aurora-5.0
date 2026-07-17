import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  Account,
  AuditLog,
  Birthday,
  BirthdayReminderLog,
  Budget,
  Category,
  Database,
  Loan,
  LoanPayment,
  Profile,
  RecurringRule,
  Transaction,
} from '@/types/database'

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

  return {
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
  }
}

function assertNoQueryError(entity: string, error: { message: string } | null): void {
  if (error) {
    throw new BackupExportDataError(entity, error.message)
  }
}
