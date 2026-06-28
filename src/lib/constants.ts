export const ACCOUNT_TYPES = ['checking', 'savings', 'cash', 'credit', 'investment', 'other'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Conto corrente',
  savings: 'Risparmio',
  cash: 'Contanti',
  credit: 'Carta di credito',
  investment: 'Investimento',
  other: 'Altro',
}

export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  income: 'Entrata',
  expense: 'Uscita',
  transfer: 'Giroconto',
}

export const RECURRING_FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'] as const
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number]

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  daily: 'Giornaliera',
  weekly: 'Settimanale',
  biweekly: 'Bisettimanale',
  monthly: 'Mensile',
  quarterly: 'Trimestrale',
  yearly: 'Annuale',
}

export const LOAN_TYPES = ['given', 'received'] as const
export type LoanType = (typeof LOAN_TYPES)[number]

export const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  given: 'Prestato',
  received: 'Ricevuto',
}

export const CURRENCIES = ['EUR', 'USD', 'GBP'] as const
export type Currency = (typeof CURRENCIES)[number]
