export type AccountType = 'bank' | 'cash' | 'credit_card' | 'savings' | 'investment'
export type TransactionType = 'income' | 'expense' | 'transfer'
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type LoanType = 'given' | 'received'

export interface Profile {
  id: string
  display_name: string
  default_currency: string
  created_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  balance: number
  currency: string
  icon: string | null
  color: string | null
  is_active: boolean
  created_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  type: TransactionType
  icon: string | null
  color: string | null
  parent_id: string | null
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
  description: string
  date: string
  notes: string | null
  transfer_to_account_id: string | null
  recurring_rule_id: string | null
  created_at: string
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
  next_occurrence: string
  is_active: boolean
  created_at: string
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  amount: number
  month: number
  year: number
  created_at: string
}

export interface Loan {
  id: string
  user_id: string
  person_name: string
  type: LoanType
  amount: number
  remaining_amount: number
  description: string | null
  date: string
  due_date: string | null
  is_settled: boolean
  created_at: string
}

export interface LoanPayment {
  id: string
  loan_id: string
  amount: number
  date: string
  notes: string | null
  created_at: string
}

export interface Birthday {
  id: string
  user_id: string
  person_name: string
  date: string
  notes: string | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      accounts: {
        Row: Account
        Insert: Omit<Account, 'id' | 'created_at'>
        Update: Partial<Omit<Account, 'id' | 'user_id' | 'created_at'>>
      }
      categories: {
        Row: Category
        Insert: Omit<Category, 'id' | 'created_at'>
        Update: Partial<Omit<Category, 'id' | 'user_id' | 'created_at'>>
      }
      transactions: {
        Row: Transaction
        Insert: Omit<Transaction, 'id' | 'created_at'>
        Update: Partial<Omit<Transaction, 'id' | 'user_id' | 'created_at'>>
      }
      recurring_rules: {
        Row: RecurringRule
        Insert: Omit<RecurringRule, 'id' | 'created_at'>
        Update: Partial<Omit<RecurringRule, 'id' | 'user_id' | 'created_at'>>
      }
      budgets: {
        Row: Budget
        Insert: Omit<Budget, 'id' | 'created_at'>
        Update: Partial<Omit<Budget, 'id' | 'user_id' | 'created_at'>>
      }
      loans: {
        Row: Loan
        Insert: Omit<Loan, 'id' | 'created_at'>
        Update: Partial<Omit<Loan, 'id' | 'user_id' | 'created_at'>>
      }
      loan_payments: {
        Row: LoanPayment
        Insert: Omit<LoanPayment, 'id' | 'created_at'>
        Update: Partial<Omit<LoanPayment, 'id' | 'created_at'>>
      }
      birthdays: {
        Row: Birthday
        Insert: Omit<Birthday, 'id' | 'created_at'>
        Update: Partial<Omit<Birthday, 'id' | 'user_id' | 'created_at'>>
      }
    }
  }
}
