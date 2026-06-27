export const CURRENCIES = ['EUR', 'USD', 'GBP'] as const
export type Currency = (typeof CURRENCIES)[number]

export const ACCOUNT_TYPES = ['bank', 'cash', 'credit_card', 'savings', 'investment'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: 'Conto corrente',
  cash: 'Contanti',
  credit_card: 'Carta di credito',
  savings: 'Risparmio',
  investment: 'Investimento',
}

export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  income: 'Entrata',
  expense: 'Uscita',
  transfer: 'Trasferimento',
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

export const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: 'LayoutDashboard' },
  { path: '/transactions', label: 'Transazioni', icon: 'ArrowLeftRight' },
  { path: '/accounts', label: 'Conti', icon: 'Wallet' },
  { path: '/categories', label: 'Categorie', icon: 'Tags' },
  { path: '/budgets', label: 'Budget', icon: 'PiggyBank' },
  { path: '/recurring', label: 'Ricorrenti', icon: 'Repeat' },
  { path: '/loans', label: 'Prestiti', icon: 'HandCoins' },
  { path: '/birthdays', label: 'Compleanni', icon: 'Cake' },
  { path: '/settings', label: 'Impostazioni', icon: 'Settings' },
] as const
