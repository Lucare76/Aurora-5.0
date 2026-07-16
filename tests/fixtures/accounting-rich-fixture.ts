import type { Account, Category, Transaction } from '@/types/database'
import { adaptTransactionRows } from '@/domain/accounting/transaction-adapter'

const userId = 'user-rich'

export const richAccounts: Account[] = [
  account({ id: 'acct-bank', name: 'Banca', balance: 5000, type: 'checking' }),
  account({ id: 'acct-savings', name: 'Risparmio', balance: 10000, type: 'savings' }),
  account({ id: 'acct-card', name: 'Carta', balance: -250, type: 'credit' }),
]

export const richCategories: Category[] = [
  category({ id: 'cat-income', name: 'Stipendio', type: 'income' }),
  category({ id: 'cat-home', name: 'Casa', type: 'expense' }),
  category({ id: 'cat-rent', name: 'Affitto', type: 'expense', parent_id: 'cat-home' }),
  category({ id: 'cat-food', name: 'Alimentari', type: 'expense' }),
  category({ id: 'cat-market', name: 'Supermercato', type: 'expense', parent_id: 'cat-food' }),
]

export const richTransactions: Transaction[] = [
  tx({ id: 'tx-2025-salary', type: 'income', amount: 2200, date: '2025-12-27', category_id: 'cat-income' }),
  tx({ id: 'tx-2025-rent', type: 'expense', amount: 900, date: '2025-12-28', category_id: 'cat-rent' }),
  tx({ id: 'tx-2025-card-a', account_id: 'acct-card', type: 'expense', amount: 45, date: '2025-12-29', category_id: 'cat-market', description: 'Spesa carta A' }),
  tx({ id: 'tx-2025-card-b', account_id: 'acct-card', type: 'expense', amount: 45, date: '2025-12-29', category_id: 'cat-market', description: 'Spesa carta B' }),
  tx({ id: 'tx-2025-legacy-out', type: 'expense', amount: 300, date: '2025-12-30', category_id: null, transfer_peer_id: 'tx-2025-legacy-in', description: 'Giroconto storico uscita' }),
  tx({ id: 'tx-2025-legacy-in', account_id: 'acct-savings', type: 'income', amount: 300, date: '2025-12-30', category_id: null, transfer_peer_id: 'tx-2025-legacy-out', description: 'Giroconto storico entrata' }),
  tx({ id: 'tx-2026-salary-jan', type: 'income', amount: 2300, date: '2026-01-05', category_id: 'cat-income' }),
  tx({ id: 'tx-2026-rent-jan', type: 'expense', amount: 950, date: '2026-01-06', category_id: 'cat-rent' }),
  tx({ id: 'tx-2026-food-jan', type: 'expense', amount: 240.55, date: '2026-01-12', category_id: 'cat-market' }),
  tx({ id: 'tx-2026-uncat-jan', type: 'expense', amount: 39.9, date: '2026-01-13', category_id: null }),
  tx({ id: 'tx-2026-new-transfer', type: 'transfer', amount: 500, date: '2026-01-20', category_id: null, transfer_peer_id: 'acct-savings', description: 'Giroconto nuovo' }),
  tx({ id: 'tx-2026-feb29-income', type: 'income', amount: 100, date: '2026-02-28', category_id: 'cat-income' }),
  tx({ id: 'tx-2024-leap', type: 'expense', amount: 29.99, date: '2024-02-29', category_id: 'cat-food' }),
  tx({ id: 'tx-2026-negative-month', type: 'expense', amount: 1500, date: '2026-03-01', category_id: 'cat-home' }),
  tx({ id: 'tx-2026-invalid-transfer', type: 'transfer', amount: 777, date: '2026-03-02', category_id: null, transfer_peer_id: 'missing-account' }),
]

export const richAppTransactions = adaptTransactionRows(richTransactions, {
  accounts: richAccounts,
  peerTransactions: richTransactions,
})

export const expectedRich = {
  december2025: {
    income: 2200,
    expense: 990,
    net: 1210,
    transfer: 300,
  },
  january2026: {
    income: 2300,
    expense: 1230.45,
    net: 1069.55,
    transfer: 500,
  },
  february2024: {
    income: 0,
    expense: 29.99,
    net: -29.99,
  },
  march2026: {
    income: 0,
    expense: 1500,
    net: -1500,
  },
  netWorth: 14750,
  categoryTotals: {
    home: 3350,
    food: 360.54,
    uncategorized: 39.9,
  },
}

function account(overrides: Partial<Account>): Account {
  return {
    id: 'acct-bank',
    user_id: userId,
    name: 'Conto',
    type: 'checking',
    color: null,
    icon: null,
    balance: 0,
    currency: 'EUR',
    is_active: true,
    is_hidden: false,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function category(overrides: Partial<Category>): Category {
  return {
    id: 'cat-home',
    user_id: userId,
    name: 'Categoria',
    type: 'expense',
    color: '#6366f1',
    icon: null,
    parent_id: null,
    is_default: false,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx',
    user_id: userId,
    account_id: 'acct-bank',
    category_id: null,
    type: 'expense',
    amount: 0,
    description: 'Movimento',
    notes: null,
    date: '2026-01-01',
    transfer_peer_id: null,
    recurring_id: null,
    receipt_url: null,
    receipt_data: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}
