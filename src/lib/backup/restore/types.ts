import type { AuroraBackupRecordCounts, AuroraBackupV1, BackupValidationIssue } from '../types'

export type RestoreMode = 'empty_account_restore' | 'merge' | 'replace_all'
export type ActiveRestoreMode = 'empty_account_restore'
export type RestoreReadiness = 'ready' | 'ready_with_warnings' | 'blocked'
export type RestoreIssueSeverity = 'error' | 'warning' | 'info'

export type DryRunOptions = {
  mode: ActiveRestoreMode
}

export type SnapshotRecord = {
  id: string
  name?: string | null
  type?: string | null
  parent_id?: string | null
  is_default?: boolean
  amount?: number
  date?: string
  account_id?: string | null
  category_id?: string | null
  loan_id?: string | null
  birthday_id?: string | null
  year?: number
  days_before?: number
}

export type CurrentUserDataSnapshot = {
  profileExists: boolean
  accounts: SnapshotRecord[]
  categories: SnapshotRecord[]
  transactions: SnapshotRecord[]
  budgets: SnapshotRecord[]
  recurringRules: SnapshotRecord[]
  loans: SnapshotRecord[]
  loanPayments: SnapshotRecord[]
  birthdays: SnapshotRecord[]
  birthdayReminderLog: SnapshotRecord[]
  auditLogs: SnapshotRecord[]
}

export type AccountEmptyResult = {
  isEmpty: boolean
  blockingCollections: string[]
  ignoredCollections: string[]
  counts: Partial<AuroraBackupRecordCounts> & { profile: number }
}

export type IdMappingStrategy = 'preserve' | 'remap' | 'blocked'

export type IdMapping = {
  collection: keyof AuroraBackupRecordCounts
  oldId: string
  proposedId: string
  strategy: IdMappingStrategy
  reason: string
}

export type IdCollisionKind =
  | 'duplicate_identical'
  | 'duplicate_logical'
  | 'id_collision'
  | 'incompatible_collision'

export type IdCollision = {
  collection: keyof AuroraBackupRecordCounts
  id?: string
  kind: IdCollisionKind
  blocking: boolean
  message: string
}

export type LogicalDuplicate = {
  collection: keyof AuroraBackupRecordCounts
  key: string
  blocking: boolean
  message: string
}

export type MissingReference = {
  collection: keyof AuroraBackupRecordCounts
  id: string
  reference: string
  code: string
  message: string
}

export type RestorePlanStep = {
  sequence: number
  collection: string
  operation: 'simulate_create'
  recordCount: number
  dependencies: string[]
  status: 'ready' | 'warning' | 'blocked'
  blockingIssues: string[]
  warnings: string[]
}

export type RestorePlan = {
  mode: ActiveRestoreMode
  steps: RestorePlanStep[]
}

export type AccountBalancePreview = {
  accountId: string
  currency: string
  backupBalance: number
  income: number
  expense: number
  transferIn: number
  transferOut: number
  netFromTransactions: number
}

export type AccountingPreview = {
  transactionCount: number
  totalIncome: number
  totalExpense: number
  netCashflow: number
  totalNetWorth: number
  transferCount: number
  transfersNeutral: boolean
  uncategorizedTransactions: number
  missingReferenceTransactions: number
  monthlySummary: Array<{ month: string; income: number; expense: number; net: number }>
  accountBalances: AccountBalancePreview[]
  loanRemainingTotal: number
}

export type TransferStatus = 'valid' | 'legacy_recoverable' | 'ambiguous' | 'blocked'

export type TransferValidationResult = {
  total: number
  valid: number
  legacyRecoverable: number
  ambiguous: number
  blocked: number
  transfersNeutral: boolean
  issues: DryRunIssue[]
}

export type DryRunIssue = {
  code: string
  severity: RestoreIssueSeverity
  path: Array<string | number>
  message: string
  details?: Record<string, string | number | boolean | null>
}

export type DryRunResult = {
  mode: ActiveRestoreMode
  readiness: RestoreReadiness
  backup: {
    format: string
    schemaVersion: number
    createdAt: string
    checksumValid: boolean
  }
  currentState: AccountEmptyResult
  summary: {
    backupRecords: number
    creatableRecords: number
    collisions: number
    duplicates: number
    missingReferences: number
    blockingErrors: number
    warnings: number
  }
  idMapping: IdMapping[]
  collisions: IdCollision[]
  logicalDuplicates: LogicalDuplicate[]
  missingReferences: MissingReference[]
  accountingPreview: AccountingPreview
  transferValidation: TransferValidationResult
  restorePlan: RestorePlanStep[]
  issues: DryRunIssue[]
}

export type DryRunInput = {
  backup: AuroraBackupV1
  inspectionIssues: BackupValidationIssue[]
  snapshot: CurrentUserDataSnapshot
  options?: DryRunOptions
}
