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

export interface BirthdayReminderLog {
  id: string
  birthday_id: string
  user_id: string
  days_before: number
  year: number
  sent_at: string
}

export type Database = {
  public: {
    Tables: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
