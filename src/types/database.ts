export type AccountType = 'checking' | 'savings' | 'cash' | 'credit' | 'investment' | 'other'
export type TransactionType = 'income' | 'expense' | 'transfer'
export type CategoryType = 'income' | 'expense' | 'both'
export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
export type LoanType = 'given' | 'received'

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

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>
      }
      accounts: {
        Row: Account
        Insert: Omit<Account, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
      }
      categories: {
        Row: Category
        Insert: Omit<Category, 'id' | 'created_at'>
        Update: Partial<Omit<Category, 'id' | 'user_id' | 'created_at'>>
      }
      transactions: {
        Row: Transaction
        Insert: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
      }
      recurring_rules: {
        Row: RecurringRule
        Insert: Omit<RecurringRule, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<RecurringRule, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
      }
      budgets: {
        Row: Budget
        Insert: Omit<Budget, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Budget, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
      }
      loans: {
        Row: Loan
        Insert: Omit<Loan, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Loan, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
      }
      loan_payments: {
        Row: LoanPayment
        Insert: Omit<LoanPayment, 'id' | 'created_at'>
        Update: Partial<Omit<LoanPayment, 'id' | 'created_at'>>
      }
      birthdays: {
        Row: Birthday
        Insert: Omit<Birthday, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Birthday, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
      }
      audit_logs: {
        Row: AuditLog
        Insert: Omit<AuditLog, 'id' | 'created_at'>
        Update: never
      }
    }
    Functions: {
      adjust_account_balance: {
        Args: { p_account_id: string; p_amount: number }
        Returns: void
      }
      create_default_categories: {
        Args: { p_user_id: string }
        Returns: void
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
        Returns: Transaction
      }
      delete_transaction_atomic: {
        Args: { p_transaction_id: string }
        Returns: void
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
        Returns: Transaction
      }
    }
  }
}
