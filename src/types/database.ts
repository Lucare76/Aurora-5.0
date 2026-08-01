export type AccountType = 'checking' | 'savings' | 'cash' | 'credit' | 'investment' | 'other'
export type TransactionType = 'income' | 'expense' | 'transfer'
export type CategoryType = 'income' | 'expense' | 'both'
export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
export type LoanType = 'given' | 'received'
export type SavingsGoalStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
export type AutomationMatchMode = 'ALL' | 'ANY'
export type AutomationApplicationMode = 'SUGGESTED' | 'MANUAL' | 'AUTOMATIC' | 'BULK'
export type AutomationApplicationResult = 'APPLIED' | 'SKIPPED' | 'CONFLICT' | 'FAILED' | 'REVERTED'
export type FinanceScope = 'PERSONAL' | 'DEPENDENT_AURORA' | 'ADI'
export type AssetPurpose = FinanceScope | 'DEPENDENT'
export type AdiEntryType = 'credit' | 'debit'
export type AdiCategory = 'SUPERMERCATO' | 'BENZINA' | 'ABBIGLIAMENTO_AURORA'

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  currency: string
  locale: string
  timezone: string
  onboarding_done: boolean
  created_at: string
  updated_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  color: string | null
  icon: string | null
  balance: number
  currency: string
  is_active: boolean
  is_hidden: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  type: CategoryType
  color: string | null
  icon: string | null
  parent_id: string | null
  is_default: boolean
  sort_order: number
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string
  category_id: string | null
  type: TransactionType
  amount: number
  description: string | null
  notes: string | null
  date: string
  transfer_peer_id: string | null
  recurring_id: string | null
  receipt_url: string | null
  receipt_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface AutomationRule {
  id: string
  user_id: string
  name: string
  description: string | null
  is_active: boolean
  priority: number
  match_mode: AutomationMatchMode
  stop_processing: boolean
  apply_to_new_transactions: boolean
  archived: boolean
  conditions: unknown[]
  actions: unknown[]
  created_at: string
  updated_at: string
}

export interface AutomationApplicationBatch {
  id: string
  user_id: string
  rule_id: string | null
  mode: 'BULK'
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'REVERTED' | 'REVERT_CONFLICT'
  transaction_count: number
  applied_count: number
  skipped_count: number
  conflict_count: number
  failed_count: number
  created_at: string
  reverted_at: string | null
}

export interface AutomationRuleApplication {
  id: string
  user_id: string
  rule_id: string | null
  transaction_id: string | null
  application_batch_id: string | null
  application_mode: AutomationApplicationMode
  previous_values: Record<string, unknown>
  applied_values: Record<string, unknown>
  result: AutomationApplicationResult
  error_code: string | null
  applied_at: string
  reverted_at: string | null
}

export interface RecurringRule {
  id: string
  user_id: string
  account_id: string
  category_id: string | null
  type: TransactionType
  amount: number
  description: string
  frequency: RecurringFrequency
  start_date: string
  end_date: string | null
  next_due_date: string
  last_run_date: string | null
  is_active: boolean
  auto_create: boolean
  created_at: string
  updated_at: string
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  amount: number
  month: number
  year: number
  created_at: string
  updated_at: string
}

export interface SavingsGoal {
  id: string
  user_id: string
  name: string
  target_amount: number
  current_amount: number
  target_date: string | null
  icon: string | null
  color: string | null
  notes: string | null
  status: SavingsGoalStatus
  archived: boolean
  created_at: string
  updated_at: string
}

export interface GoalContribution {
  id: string
  goal_id: string
  user_id: string
  amount: number
  date: string
  note: string | null
  created_at: string
}

export interface Loan {
  id: string
  user_id: string
  counterpart: string
  type: LoanType
  amount: number
  remaining: number
  description: string | null
  due_date: string | null
  is_settled: boolean
  settled_at: string | null
  created_at: string
  updated_at: string
}

export interface LoanPayment {
  id: string
  loan_id: string
  user_id: string
  amount: number
  paid_at: string
  notes: string | null
  created_at: string
}

export interface Birthday {
  id: string
  user_id: string
  name: string
  birth_date: string
  reminder_days: number[]
  notes: string | null
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  action: string
  table_name: string
  record_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export interface BirthdayReminderLog {
  id: string
  birthday_id: string
  user_id: string
  days_before: number
  year: number
  sent_at: string
}

export interface FinancialHealthSnapshot {
  id: string
  user_id: string
  period_key: string
  period_start: string
  period_end: string
  total_score: number | null
  level: string | null
  is_provisional: boolean
  data_quality: string
  observed_weight: number
  metrics: Record<string, unknown>
  component_scores: Record<string, unknown>
  factors: Record<string, unknown>[]
  recommendations: Record<string, unknown>[]
  calculation_version: string
  calculated_at: string
  created_at: string
  updated_at: string
}

export interface DependentBeneficiary {
  id: string
  user_id: string
  name: string
  relationship: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface AccountPurposeLink {
  id: string
  user_id: string
  account_id: string
  beneficiary_id: string | null
  purpose: AssetPurpose
  label: string | null
  created_at: string
  updated_at: string
}

export interface FinanceTransferMetadata {
  id: string
  user_id: string
  source_transaction_id: string
  destination_transaction_id: string
  source_scope: FinanceScope
  destination_scope: FinanceScope
  reason: string | null
  note: string | null
  idempotency_key: string | null
  created_at: string
  updated_at: string
}

export interface AdiEntry {
  id: string
  user_id: string
  transaction_id: string | null
  entry_type: AdiEntryType
  adi_category: AdiCategory | null
  amount: number
  date: string
  reference_period: string | null
  description: string
  note: string | null
  funding_source: 'ADI'
  created_at: string
  updated_at: string
}

export interface DataIntegrityScanRun {
  id: string
  user_id: string
  mode: 'quick' | 'full' | 'targeted'
  status: 'running' | 'completed' | 'failed'
  ruleset_version: string
  started_at: string
  completed_at: string | null
  detected_count: number
  critical_count: number
  warning_count: number
  info_count: number
  error_code: string | null
  metadata: Record<string, unknown>
}

export interface DataIntegrityIssueRecord {
  id: string
  user_id: string
  fingerprint: string
  ruleset_version: string
  rule_code: string
  category: string
  severity: string
  status: string
  title: string
  description: string
  explanation: string
  impact: string
  recommendation: string
  confidence: string
  entity_type: string
  entity_ids: string[]
  evidence: Record<string, unknown>[]
  allowed_actions: string[]
  source_path: string | null
  first_detected_at: string
  last_detected_at: string
  resolved_at: string | null
  ignored_at: string | null
  ignored_reason: string | null
  acknowledged_at: string | null
  last_scan_run_id: string | null
  created_at: string
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      [key: string]: {
        Row: unknown
        Insert: unknown
        Update: unknown
        Relationships: unknown[]
      }
      profiles: {
        Row: {
          id: string
          display_name: string | null
          avatar_url: string | null
          currency: string
          locale: string
          timezone: string
          onboarding_done: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          avatar_url?: string | null
          currency?: string
          locale?: string
          timezone?: string
          onboarding_done?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          avatar_url?: string | null
          currency?: string
          locale?: string
          timezone?: string
          onboarding_done?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      accounts: {
        Row: {
          id: string
          user_id: string
          name: string
          type: AccountType
          color: string | null
          icon: string | null
          balance: number
          currency: string
          is_active: boolean
          is_hidden: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type?: string
          color?: string | null
          icon?: string | null
          balance?: number
          currency?: string
          is_active?: boolean
          is_hidden?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: string
          color?: string | null
          icon?: string | null
          balance?: number
          currency?: string
          is_active?: boolean
          is_hidden?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          type: CategoryType
          color: string | null
          icon: string | null
          parent_id: string | null
          is_default: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type?: string
          color?: string | null
          icon?: string | null
          parent_id?: string | null
          is_default?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: string
          color?: string | null
          icon?: string | null
          parent_id?: string | null
          is_default?: boolean
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          account_id: string
          category_id: string | null
          type: TransactionType
          amount: number
          description: string | null
          notes: string | null
          date: string
          transfer_peer_id: string | null
          recurring_id: string | null
          receipt_url: string | null
          receipt_data: Record<string, unknown> | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id: string
          category_id?: string | null
          type: string
          amount: number
          description?: string | null
          notes?: string | null
          date: string
          transfer_peer_id?: string | null
          recurring_id?: string | null
          receipt_url?: string | null
          receipt_data?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          account_id?: string
          category_id?: string | null
          type?: string
          amount?: number
          description?: string | null
          notes?: string | null
          date?: string
          transfer_peer_id?: string | null
          recurring_id?: string | null
          receipt_url?: string | null
          receipt_data?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_rules: {
        Row: {
          id: string
          user_id: string
          account_id: string
          category_id: string | null
          type: TransactionType
          amount: number
          description: string
          frequency: RecurringFrequency
          start_date: string
          end_date: string | null
          next_due_date: string
          last_run_date: string | null
          is_active: boolean
          auto_create: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id: string
          category_id?: string | null
          type: string
          amount: number
          description: string
          frequency: string
          start_date: string
          end_date?: string | null
          next_due_date: string
          last_run_date?: string | null
          is_active?: boolean
          auto_create?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          account_id?: string
          category_id?: string | null
          type?: string
          amount?: number
          description?: string
          frequency?: string
          start_date?: string
          end_date?: string | null
          next_due_date?: string
          last_run_date?: string | null
          is_active?: boolean
          auto_create?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          id: string
          user_id: string
          category_id: string
          amount: number
          month: number
          year: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category_id: string
          amount: number
          month: number
          year: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          category_id?: string
          amount?: number
          month?: number
          year?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      savings_goals: {
        Row: {
          id: string
          user_id: string
          name: string
          target_amount: number
          current_amount: number
          target_date: string | null
          icon: string | null
          color: string | null
          notes: string | null
          status: SavingsGoalStatus
          archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          target_amount: number
          current_amount?: number
          target_date?: string | null
          icon?: string | null
          color?: string | null
          notes?: string | null
          status?: SavingsGoalStatus
          archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          target_amount?: number
          current_amount?: number
          target_date?: string | null
          icon?: string | null
          color?: string | null
          notes?: string | null
          status?: SavingsGoalStatus
          archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      goal_contributions: {
        Row: {
          id: string
          goal_id: string
          user_id: string
          amount: number
          date: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          goal_id: string
          user_id: string
          amount: number
          date?: string
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          goal_id?: string
          user_id?: string
          amount?: number
          date?: string
          note?: string | null
          created_at?: string
        }
        Relationships: []
      }
      loans: {
        Row: {
          id: string
          user_id: string
          counterpart: string
          type: LoanType
          amount: number
          remaining: number
          description: string | null
          due_date: string | null
          is_settled: boolean
          settled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          counterpart: string
          type: string
          amount: number
          remaining: number
          description?: string | null
          due_date?: string | null
          is_settled?: boolean
          settled_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          counterpart?: string
          type?: string
          amount?: number
          remaining?: number
          description?: string | null
          due_date?: string | null
          is_settled?: boolean
          settled_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      loan_payments: {
        Row: {
          id: string
          loan_id: string
          user_id: string
          amount: number
          paid_at: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          loan_id: string
          user_id: string
          amount: number
          paid_at?: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          loan_id?: string
          user_id?: string
          amount?: number
          paid_at?: string
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      birthdays: {
        Row: {
          id: string
          user_id: string
          name: string
          birth_date: string
          reminder_days: number[]
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          birth_date: string
          reminder_days?: number[]
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          birth_date?: string
          reminder_days?: number[]
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          table_name: string
          record_id: string | null
          old_data: Record<string, unknown> | null
          new_data: Record<string, unknown> | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          table_name: string
          record_id?: string | null
          old_data?: Record<string, unknown> | null
          new_data?: Record<string, unknown> | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          [_ in never]: never
        }
        Relationships: []
      }
      birthday_reminder_log: {
        Row: {
          id: string
          birthday_id: string
          user_id: string
          days_before: number
          year: number
          sent_at: string
        }
        Insert: {
          id?: string
          birthday_id: string
          user_id: string
          days_before: number
          year: number
          sent_at?: string
        }
        Update: {
          [_ in never]: never
        }
        Relationships: []
      }
      dashboard_preferences: {
        Row: {
          user_id: string
          visible_widgets: string[]
          widget_order: string[]
          compact_mode: boolean
          default_period: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          visible_widgets?: string[]
          widget_order?: string[]
          compact_mode?: boolean
          default_period?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          visible_widgets?: string[]
          widget_order?: string[]
          compact_mode?: boolean
          default_period?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      data_integrity_scan_runs: {
        Row: DataIntegrityScanRun
        Insert: {
          id?: string
          user_id: string
          mode?: 'quick' | 'full' | 'targeted'
          status?: 'running' | 'completed' | 'failed'
          ruleset_version: string
          started_at?: string
          completed_at?: string | null
          detected_count?: number
          critical_count?: number
          warning_count?: number
          info_count?: number
          error_code?: string | null
          metadata?: Record<string, unknown>
        }
        Update: Partial<DataIntegrityScanRun>
        Relationships: []
      }
      data_integrity_issues: {
        Row: DataIntegrityIssueRecord
        Insert: {
          id?: string
          user_id: string
          fingerprint: string
          ruleset_version: string
          rule_code: string
          category: string
          severity: string
          status?: string
          title: string
          description: string
          explanation: string
          impact: string
          recommendation: string
          confidence?: string
          entity_type: string
          entity_ids?: string[]
          evidence?: Record<string, unknown>[]
          allowed_actions?: string[]
          source_path?: string | null
          first_detected_at?: string
          last_detected_at?: string
          resolved_at?: string | null
          ignored_at?: string | null
          ignored_reason?: string | null
          acknowledged_at?: string | null
          last_scan_run_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<DataIntegrityIssueRecord>
        Relationships: []
      }
      financial_health_snapshots: {
        Row: {
          id: string
          user_id: string
          period_key: string
          period_start: string
          period_end: string
          total_score: number | null
          level: string | null
          is_provisional: boolean
          data_quality: string
          observed_weight: number
          metrics: Record<string, unknown>
          component_scores: Record<string, unknown>
          factors: Record<string, unknown>[]
          recommendations: Record<string, unknown>[]
          calculation_version: string
          calculated_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          period_key: string
          period_start: string
          period_end: string
          total_score?: number | null
          level?: string | null
          is_provisional?: boolean
          data_quality: string
          observed_weight: number
          metrics: Record<string, unknown>
          component_scores: Record<string, unknown>
          factors: Record<string, unknown>[]
          recommendations: Record<string, unknown>[]
          calculation_version: string
          calculated_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          period_key?: string
          period_start?: string
          period_end?: string
          total_score?: number | null
          level?: string | null
          is_provisional?: boolean
          data_quality?: string
          observed_weight?: number
          metrics?: Record<string, unknown>
          component_scores?: Record<string, unknown>
          factors?: Record<string, unknown>[]
          recommendations?: Record<string, unknown>[]
          calculation_version?: string
          calculated_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      backup_restore_tokens: {
        Row: {
          id: string
          user_id: string
          token_hash: string
          backup_checksum: string
          schema_version: number
          mode: string
          readiness: string
          expires_at: string
          used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token_hash: string
          backup_checksum: string
          schema_version: number
          mode: string
          readiness: string
          expires_at: string
          used_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          token_hash?: string
          backup_checksum?: string
          schema_version?: number
          mode?: string
          readiness?: string
          expires_at?: string
          used_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      backup_restore_runs: {
        Row: {
          id: string
          user_id: string
          token_id: string | null
          backup_checksum: string
          schema_version: number
          mode: string
          status: string
          started_at: string
          completed_at: string | null
          counts: Record<string, unknown>
          error_code: string | null
          app_version: string | null
        }
        Insert: {
          id?: string
          user_id: string
          token_id?: string | null
          backup_checksum: string
          schema_version: number
          mode: string
          status: string
          started_at?: string
          completed_at?: string | null
          counts?: Record<string, unknown>
          error_code?: string | null
          app_version?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          token_id?: string | null
          backup_checksum?: string
          schema_version?: number
          mode?: string
          status?: string
          started_at?: string
          completed_at?: string | null
          counts?: Record<string, unknown>
          error_code?: string | null
          app_version?: string | null
        }
        Relationships: []
      }
      dependent_beneficiaries: {
        Row: DependentBeneficiary
        Insert: {
          id?: string
          user_id: string
          name: string
          relationship?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<DependentBeneficiary>
        Relationships: []
      }
      account_purpose_links: {
        Row: AccountPurposeLink
        Insert: {
          id?: string
          user_id: string
          account_id: string
          beneficiary_id?: string | null
          purpose?: AssetPurpose
          label?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<AccountPurposeLink>
        Relationships: []
      }
      finance_transfer_metadata: {
        Row: FinanceTransferMetadata
        Insert: {
          id?: string
          user_id: string
          source_transaction_id: string
          destination_transaction_id: string
          source_scope: FinanceScope
          destination_scope: FinanceScope
          reason?: string | null
          note?: string | null
          idempotency_key?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<FinanceTransferMetadata>
        Relationships: []
      }
      adi_entries: {
        Row: AdiEntry
        Insert: {
          id?: string
          user_id: string
          transaction_id?: string | null
          entry_type: AdiEntryType
          adi_category?: AdiCategory | null
          amount: number
          date: string
          reference_period?: string | null
          description: string
          note?: string | null
          funding_source?: 'ADI'
          created_at?: string
          updated_at?: string
        }
        Update: Partial<AdiEntry>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [key: string]: {
        Args: unknown
        Returns: unknown
      }
      adjust_account_balance: {
        Args: { p_account_id: string; p_amount: number }
        Returns: undefined
      }
      create_default_categories: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      create_transaction_atomic: {
        Args: {
          p_account_id: string
          p_type: string
          p_amount: number
          p_date: string
          p_description?: string | null
          p_category_id?: string | null
          p_notes?: string | null
          p_destination_account_id?: string | null
          p_recurring_id?: string | null
        }
        Returns: Record<string, unknown>
      }
      delete_transaction_atomic: {
        Args: { p_transaction_id: string }
        Returns: undefined
      }
      update_transaction_atomic: {
        Args: {
          p_transaction_id: string
          p_account_id?: string | null
          p_type?: string | null
          p_amount?: number | null
          p_date?: string | null
          p_description?: string | null
          p_category_id?: string | null
          p_notes?: string | null
          p_destination_account_id?: string | null
          p_clear_category?: boolean
        }
        Returns: Record<string, unknown>
      }
      delete_user_account: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      create_recurring_transaction: {
        Args: {
          p_user_id: string
          p_account_id: string
          p_category_id: string | null
          p_type: string
          p_amount: number
          p_description: string
          p_date: string
          p_recurring_id: string
        }
        Returns: undefined
      }
      restore_aurora_backup_v1_empty_account: {
        Args: {
          p_token_id: string
          p_token: string
          p_backup: Record<string, unknown>
        }
        Returns: Record<string, unknown>
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
