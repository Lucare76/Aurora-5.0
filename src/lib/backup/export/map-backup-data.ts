import type {
  Account,
  AuditLog,
  Birthday,
  BirthdayReminderLog,
  Budget,
  Category,
  Loan,
  LoanPayment,
  Profile,
  RecurringRule,
  Transaction,
} from '@/types/database'

import type {
  AuroraBackupAccountV1,
  AuroraBackupAuditLogV1,
  AuroraBackupBirthdayReminderLogV1,
  AuroraBackupBirthdayV1,
  AuroraBackupBudgetV1,
  AuroraBackupCategoryV1,
  AuroraBackupDataV1,
  AuroraBackupLoanPaymentV1,
  AuroraBackupLoanV1,
  AuroraBackupProfileV1,
  AuroraBackupRecurringRuleV1,
  AuroraBackupTransactionV1,
} from '../types'
import type { UserBackupData } from './fetch-user-backup-data'

export function mapUserBackupDataToV1Data(input: UserBackupData): AuroraBackupDataV1 {
  return {
    profile: mapProfile(input.profile),
    accounts: input.accounts.map(mapAccount),
    categories: input.categories.map(mapCategory),
    transactions: input.transactions.map(mapTransaction),
    budgets: input.budgets.map(mapBudget),
    recurringRules: input.recurringRules.map(mapRecurringRule),
    loans: input.loans.map(mapLoan),
    loanPayments: input.loanPayments.map(mapLoanPayment),
    birthdays: input.birthdays.map(mapBirthday),
    birthdayReminderLog: input.birthdayReminderLog.map(mapBirthdayReminderLog),
    auditLogs: input.auditLogs.map(mapAuditLog),
  }
}

export function mapProfile(profile: Profile | null): AuroraBackupProfileV1 {
  return {
    id: profile?.id,
    display_name: profile?.display_name ?? null,
    avatar_url: profile?.avatar_url ?? null,
    currency: profile?.currency ?? 'EUR',
    locale: profile?.locale ?? 'it-IT',
    timezone: profile?.timezone ?? 'Europe/Rome',
    onboarding_done: profile?.onboarding_done ?? false,
    created_at: profile?.created_at,
    updated_at: profile?.updated_at,
  }
}

export function mapAccount(account: Account): AuroraBackupAccountV1 {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    color: account.color,
    icon: account.icon,
    balance: account.balance,
    currency: account.currency,
    is_active: account.is_active,
    is_hidden: account.is_hidden,
    sort_order: account.sort_order,
    created_at: account.created_at,
    updated_at: account.updated_at,
  }
}

export function mapCategory(category: Category): AuroraBackupCategoryV1 {
  return {
    id: category.id,
    name: category.name,
    type: category.type,
    color: category.color,
    icon: category.icon,
    parent_id: category.parent_id,
    is_default: category.is_default,
    sort_order: category.sort_order,
    created_at: category.created_at,
  }
}

export function mapTransaction(transaction: Transaction): AuroraBackupTransactionV1 {
  return {
    id: transaction.id,
    account_id: transaction.account_id,
    category_id: transaction.category_id,
    type: transaction.type,
    amount: transaction.amount,
    description: transaction.description,
    notes: transaction.notes,
    date: transaction.date,
    transfer_peer_id: transaction.transfer_peer_id,
    recurring_id: transaction.recurring_id,
    receipt_url: transaction.receipt_url,
    receipt_data: transaction.receipt_data,
    created_at: transaction.created_at,
    updated_at: transaction.updated_at,
  }
}

export function mapBudget(budget: Budget): AuroraBackupBudgetV1 {
  return {
    id: budget.id,
    category_id: budget.category_id,
    amount: budget.amount,
    month: budget.month,
    year: budget.year,
    created_at: budget.created_at,
    updated_at: budget.updated_at,
  }
}

export function mapRecurringRule(rule: RecurringRule): AuroraBackupRecurringRuleV1 {
  return {
    id: rule.id,
    account_id: rule.account_id,
    category_id: rule.category_id,
    type: rule.type,
    amount: rule.amount,
    description: rule.description,
    frequency: rule.frequency,
    start_date: rule.start_date,
    end_date: rule.end_date,
    next_due_date: rule.next_due_date,
    last_run_date: rule.last_run_date,
    is_active: rule.is_active,
    auto_create: rule.auto_create,
    created_at: rule.created_at,
    updated_at: rule.updated_at,
  }
}

export function mapLoan(loan: Loan): AuroraBackupLoanV1 {
  return {
    id: loan.id,
    counterpart: loan.counterpart,
    type: loan.type,
    amount: loan.amount,
    remaining: loan.remaining,
    description: loan.description,
    due_date: loan.due_date,
    is_settled: loan.is_settled,
    settled_at: loan.settled_at,
    created_at: loan.created_at,
    updated_at: loan.updated_at,
  }
}

export function mapLoanPayment(payment: LoanPayment): AuroraBackupLoanPaymentV1 {
  return {
    id: payment.id,
    loan_id: payment.loan_id,
    amount: payment.amount,
    paid_at: payment.paid_at,
    notes: payment.notes,
    created_at: payment.created_at,
  }
}

export function mapBirthday(birthday: Birthday): AuroraBackupBirthdayV1 {
  return {
    id: birthday.id,
    name: birthday.name,
    birth_date: birthday.birth_date,
    reminder_days: [...birthday.reminder_days],
    notes: birthday.notes,
    created_at: birthday.created_at,
    updated_at: birthday.updated_at,
  }
}

export function mapBirthdayReminderLog(log: BirthdayReminderLog): AuroraBackupBirthdayReminderLogV1 {
  return {
    id: log.id,
    birthday_id: log.birthday_id,
    days_before: log.days_before,
    year: log.year,
    sent_at: log.sent_at,
  }
}

export function mapAuditLog(log: AuditLog): AuroraBackupAuditLogV1 {
  return {
    id: log.id,
    action: log.action,
    table_name: log.table_name,
    record_id: log.record_id,
    old_data: log.old_data,
    new_data: log.new_data,
    created_at: log.created_at,
  }
}
