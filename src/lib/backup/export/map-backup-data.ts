import type { Notification } from '@/lib/notifications/types'
import type {
  NotificationPreference,
  NotificationSourceMute,
  NotificationUserSettings,
} from '@/lib/notifications/preferences-types'
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
  FinancialHealthSnapshot,
  LeaveEntry,
  LeaveSettings,
  Loan,
  LoanPayment,
  Profile,
  RecurringRule,
  Transaction,
} from '@/types/database'

import type {
  AuroraBackupAccountV1,
  AuroraBackupAuditLogV1,
  AuroraBackupAutomationApplicationBatchV1,
  AuroraBackupAutomationRuleApplicationV1,
  AuroraBackupAutomationRuleV1,
  AuroraBackupBirthdayReminderLogV1,
  AuroraBackupBirthdayV1,
  AuroraBackupBudgetV1,
  AuroraBackupCategoryV1,
  AuroraBackupDataV1,
  AuroraBackupDashboardPreferencesV1,
  AuroraBackupDataIntegrityIssueV1,
  AuroraBackupDependentBeneficiaryV1,
  AuroraBackupAccountPurposeLinkV1,
  AuroraBackupAdiEntryV1,
  AuroraBackupFinanceTransferMetadataV1,
  AuroraBackupFinancialHealthSnapshotV1,
  AuroraBackupFinancialScenarioV1,
  AuroraBackupLeaveEntryV1,
  AuroraBackupLeaveSettingsV1,
  AuroraBackupLoanPaymentV1,
  AuroraBackupLoanV1,
  AuroraBackupNotificationPreferenceV1,
  AuroraBackupNotificationSourceMuteV1,
  AuroraBackupNotificationUserSettingsV1,
  AuroraBackupNotificationV1,
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
    automationRules: (input.automationRules ?? []).map(mapAutomationRule),
    automationApplicationBatches: (input.automationApplicationBatches ?? []).map(mapAutomationApplicationBatch),
    automationRuleApplications: (input.automationRuleApplications ?? []).map(mapAutomationRuleApplication),
    notifications: (input.notifications ?? []).map(mapNotification),
    ...(input.notificationUserSettings
      ? { notificationUserSettings: mapNotificationUserSettings(input.notificationUserSettings) }
      : {}),
    ...(input.notificationPreferences && input.notificationPreferences.length > 0
      ? { notificationPreferences: input.notificationPreferences.map(mapNotificationPreference) }
      : {}),
    ...(input.notificationSourceMutes && input.notificationSourceMutes.length > 0
      ? { notificationSourceMutes: input.notificationSourceMutes.map(mapNotificationSourceMute) }
      : {}),
    ...(input.financialHealthSnapshots && input.financialHealthSnapshots.length > 0
      ? { financialHealthSnapshots: input.financialHealthSnapshots.map(mapFinancialHealthSnapshot) }
      : {}),
    ...(input.dashboardPreferences
      ? { dashboardPreferences: mapDashboardPreferences(input.dashboardPreferences) }
      : {}),
    ...(input.dataIntegrityIssues && input.dataIntegrityIssues.length > 0
      ? { dataIntegrityIssues: input.dataIntegrityIssues.map(mapDataIntegrityIssue) }
      : {}),
    ...(input.financialScenarios && input.financialScenarios.length > 0
      ? { financialScenarios: input.financialScenarios.map(mapFinancialScenario) }
      : {}),
    ...(input.dependentBeneficiaries && input.dependentBeneficiaries.length > 0
      ? { dependentBeneficiaries: input.dependentBeneficiaries.map(mapDependentBeneficiary) }
      : {}),
    ...(input.accountPurposeLinks && input.accountPurposeLinks.length > 0
      ? { accountPurposeLinks: input.accountPurposeLinks.map(mapAccountPurposeLink) }
      : {}),
    ...(input.financeTransferMetadata && input.financeTransferMetadata.length > 0
      ? { financeTransferMetadata: input.financeTransferMetadata.map(mapFinanceTransferMetadata) }
      : {}),
    ...(input.adiEntries && input.adiEntries.length > 0
      ? { adiEntries: input.adiEntries.map(mapAdiEntry) }
      : {}),
    ...(input.leaveSettings && input.leaveSettings.length > 0
      ? { leaveSettings: input.leaveSettings.map(mapLeaveSettings) }
      : {}),
    ...(input.leaveEntries && input.leaveEntries.length > 0
      ? { leaveEntries: input.leaveEntries.map(mapLeaveEntry) }
      : {}),
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

export function mapAutomationRule(rule: AutomationRule): AuroraBackupAutomationRuleV1 {
  return {
    id: rule.id,
    name: rule.name,
    description: rule.description,
    is_active: rule.is_active,
    priority: rule.priority,
    match_mode: rule.match_mode,
    stop_processing: rule.stop_processing,
    apply_to_new_transactions: rule.apply_to_new_transactions,
    archived: rule.archived,
    conditions: rule.conditions as AuroraBackupAutomationRuleV1['conditions'],
    actions: rule.actions as AuroraBackupAutomationRuleV1['actions'],
    created_at: rule.created_at,
    updated_at: rule.updated_at,
  }
}

export function mapAutomationApplicationBatch(batch: AutomationApplicationBatch): AuroraBackupAutomationApplicationBatchV1 {
  return {
    id: batch.id,
    rule_id: batch.rule_id,
    mode: batch.mode,
    status: batch.status,
    transaction_count: batch.transaction_count,
    applied_count: batch.applied_count,
    skipped_count: batch.skipped_count,
    conflict_count: batch.conflict_count,
    failed_count: batch.failed_count,
    created_at: batch.created_at,
    reverted_at: batch.reverted_at,
  }
}

export function mapAutomationRuleApplication(application: AutomationRuleApplication): AuroraBackupAutomationRuleApplicationV1 {
  return {
    id: application.id,
    rule_id: application.rule_id,
    transaction_id: application.transaction_id,
    application_batch_id: application.application_batch_id,
    application_mode: application.application_mode,
    previous_values: application.previous_values,
    applied_values: application.applied_values,
    result: application.result,
    error_code: application.error_code,
    applied_at: application.applied_at,
    reverted_at: application.reverted_at,
  }
}

export function mapNotificationUserSettings(s: NotificationUserSettings): AuroraBackupNotificationUserSettingsV1 {
  return {
    notifications_enabled: s.notifications_enabled,
    show_info: s.show_info,
    show_warning: s.show_warning,
    show_critical: s.show_critical,
    quiet_hours_enabled: s.quiet_hours_enabled,
    quiet_hours_start: s.quiet_hours_start,
    quiet_hours_end: s.quiet_hours_end,
    timezone: s.timezone,
    digest_enabled: s.digest_enabled,
    digest_frequency: s.digest_frequency,
    digest_time: s.digest_time,
    created_at: s.created_at,
    updated_at: s.updated_at,
  }
}

export function mapNotificationPreference(p: NotificationPreference): AuroraBackupNotificationPreferenceV1 {
  return {
    id: p.id,
    notification_type: p.notification_type,
    is_enabled: p.is_enabled,
    config: p.config,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }
}

export function mapNotificationSourceMute(m: NotificationSourceMute): AuroraBackupNotificationSourceMuteV1 {
  return {
    id: m.id,
    source_type: m.source_type,
    source_id: m.source_id,
    notification_type: m.notification_type,
    muted_until: m.muted_until,
    reason: m.reason,
    created_at: m.created_at,
    updated_at: m.updated_at,
  }
}

export function mapNotification(n: Notification): AuroraBackupNotificationV1 {
  return {
    id: n.id,
    type: n.type,
    severity: n.severity,
    title: n.title,
    message: n.message,
    dedupe_key: n.dedupe_key,
    source_type: n.source_type,
    source_id: n.source_id ?? undefined,
    source_url: n.source_url ?? undefined,
    metadata: n.metadata ?? undefined,
    is_read: n.is_read,
    archived_at: n.archived_at ?? undefined,
    resolved_at: n.resolved_at ?? undefined,
    first_detected_at: n.first_detected_at,
    created_at: n.created_at,
  }
}

export function mapFinancialHealthSnapshot(snapshot: FinancialHealthSnapshot): AuroraBackupFinancialHealthSnapshotV1 {
  return {
    id: snapshot.id,
    period_key: snapshot.period_key,
    period_start: snapshot.period_start,
    period_end: snapshot.period_end,
    total_score: snapshot.total_score,
    level: snapshot.level,
    is_provisional: snapshot.is_provisional,
    data_quality: snapshot.data_quality,
    observed_weight: snapshot.observed_weight,
    metrics: snapshot.metrics,
    component_scores: snapshot.component_scores,
    factors: snapshot.factors,
    recommendations: snapshot.recommendations,
    calculation_version: snapshot.calculation_version,
    calculated_at: snapshot.calculated_at,
    created_at: snapshot.created_at,
    updated_at: snapshot.updated_at,
  }
}

export function mapDashboardPreferences(preferences: NonNullable<UserBackupData['dashboardPreferences']>): AuroraBackupDashboardPreferencesV1 {
  return {
    visible_widgets: [...preferences.visible_widgets],
    widget_order: [...preferences.widget_order],
    compact_mode: preferences.compact_mode,
    default_period: preferences.default_period === 'previous_month' ? 'previous_month' : 'current_month',
    created_at: preferences.created_at,
    updated_at: preferences.updated_at,
  }
}

export function mapDataIntegrityIssue(issue: NonNullable<UserBackupData['dataIntegrityIssues']>[number]): AuroraBackupDataIntegrityIssueV1 {
  return {
    fingerprint: issue.fingerprint,
    rule_code: issue.rule_code,
    status: issue.status as AuroraBackupDataIntegrityIssueV1['status'],
    ignored_reason: issue.ignored_reason,
    acknowledged_at: issue.acknowledged_at,
    ignored_at: issue.ignored_at,
    resolved_at: issue.resolved_at,
    ruleset_version: issue.ruleset_version,
    updated_at: issue.updated_at,
  }
}

export function mapFinancialScenario(row: Record<string, unknown>): AuroraBackupFinancialScenarioV1 {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    status: row.status as string,
    horizon_months: row.horizon_months as number,
    start_date: row.start_date as string,
    end_date: row.end_date as string,
    currency: (row.currency as string | null) ?? null,
    actions: (row.actions as Record<string, unknown>[]) ?? [],
    assumptions: (row.assumptions as Record<string, unknown>) ?? {},
    engine_version: row.engine_version as string,
    schema_version: row.schema_version as number,
    action_registry_version: row.action_registry_version as string,
    baseline_as_of: (row.baseline_as_of as string | null) ?? null,
    last_calculated_at: (row.last_calculated_at as string | null) ?? null,
    result_summary: (row.result_summary as Record<string, unknown> | null) ?? null,
    is_favorite: row.is_favorite as boolean,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  }
}

export function mapDependentBeneficiary(row: NonNullable<UserBackupData['dependentBeneficiaries']>[number]): AuroraBackupDependentBeneficiaryV1 {
  return {
    id: row.id,
    name: row.name,
    relationship: row.relationship,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function mapAccountPurposeLink(row: NonNullable<UserBackupData['accountPurposeLinks']>[number]): AuroraBackupAccountPurposeLinkV1 {
  return {
    id: row.id,
    account_id: row.account_id,
    beneficiary_id: row.beneficiary_id,
    purpose: row.purpose,
    label: row.label,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function mapAdiEntry(row: NonNullable<UserBackupData['adiEntries']>[number]): AuroraBackupAdiEntryV1 {
  return {
    id: row.id,
    transaction_id: row.transaction_id,
    entry_type: row.entry_type,
    adi_category: row.adi_category,
    amount: row.amount,
    date: row.date,
    reference_period: row.reference_period,
    description: row.description,
    note: row.note,
    funding_source: row.funding_source,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function mapFinanceTransferMetadata(row: NonNullable<UserBackupData['financeTransferMetadata']>[number]): AuroraBackupFinanceTransferMetadataV1 {
  return {
    id: row.id,
    source_transaction_id: row.source_transaction_id,
    destination_transaction_id: row.destination_transaction_id,
    source_scope: row.source_scope,
    destination_scope: row.destination_scope,
    reason: row.reason,
    note: row.note,
    idempotency_key: row.idempotency_key,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function mapLeaveSettings(row: LeaveSettings): AuroraBackupLeaveSettingsV1 {
  return {
    id: row.id,
    vacation_days_per_year: row.vacation_days_per_year,
    permit_104_hours_per_month: row.permit_104_hours_per_month,
    timezone: row.timezone,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function mapLeaveEntry(row: LeaveEntry): AuroraBackupLeaveEntryV1 {
  return {
    id: row.id,
    type: row.type,
    start_date: row.start_date,
    end_date: row.end_date,
    days: row.days,
    hours: row.hours,
    start_time: row.start_time,
    end_time: row.end_time,
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
