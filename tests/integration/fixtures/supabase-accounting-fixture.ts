import type { Account, Category, Transaction } from '@/types/database'

export const sprint5UserAId = '10000000-0000-4000-8000-000000000001'
export const sprint5UserBId = '10000000-0000-4000-8000-000000000002'

export const sprint5AccountIds = {
  bank: '20000000-0000-4000-8000-000000000001',
  savings: '20000000-0000-4000-8000-000000000002',
  card: '20000000-0000-4000-8000-000000000003',
  userB: '20000000-0000-4000-8000-000000000004',
} as const

export const sprint5CategoryIds = {
  salary: '30000000-0000-4000-8000-000000000001',
  home: '30000000-0000-4000-8000-000000000002',
  rent: '30000000-0000-4000-8000-000000000003',
  food: '30000000-0000-4000-8000-000000000004',
  grocery: '30000000-0000-4000-8000-000000000005',
  cardPayments: '30000000-0000-4000-8000-000000000006',
  userB: '30000000-0000-4000-8000-000000000007',
} as const

export const sprint5TransactionIds = {
  oldIncome: '40000000-0000-4000-8000-000000000001',
  oldExpense: '40000000-0000-4000-8000-000000000002',
  legacyOut: '40000000-0000-4000-8000-000000000003',
  legacyIn: '40000000-0000-4000-8000-000000000004',
  newTransfer: '40000000-0000-4000-8000-000000000005',
  uncategorized: '40000000-0000-4000-8000-000000000006',
  cardA: '40000000-0000-4000-8000-000000000007',
  cardB: '40000000-0000-4000-8000-000000000008',
  currentIncome: '40000000-0000-4000-8000-000000000009',
  currentExpense: '40000000-0000-4000-8000-000000000010',
  userB: '40000000-0000-4000-8000-000000000011',
} as const

export const sprint5OpeningBalances = {
  bank: 10000,
  savings: 25000,
  card: -250,
  userB: 999,
} as const

export const sprint5Accounts: Account[] = [
  account({ id: sprint5AccountIds.bank, name: 'Sprint 5 Banca', balance: sprint5OpeningBalances.bank, type: 'checking' }),
  account({ id: sprint5AccountIds.savings, name: 'Sprint 5 Risparmio', balance: sprint5OpeningBalances.savings, type: 'savings' }),
  account({ id: sprint5AccountIds.card, name: 'Sprint 5 Carta', balance: sprint5OpeningBalances.card, type: 'credit' }),
  account({ id: sprint5AccountIds.userB, user_id: sprint5UserBId, name: 'Sprint 5 User B', balance: sprint5OpeningBalances.userB }),
]

export const sprint5Categories: Category[] = [
  category({ id: sprint5CategoryIds.salary, name: 'Stipendio', type: 'income' }),
  category({ id: sprint5CategoryIds.home, name: 'Casa', type: 'expense' }),
  category({ id: sprint5CategoryIds.rent, name: 'Affitto', type: 'expense', parent_id: sprint5CategoryIds.home }),
  category({ id: sprint5CategoryIds.food, name: 'Alimentari', type: 'expense' }),
  category({ id: sprint5CategoryIds.grocery, name: 'Supermercato', type: 'expense', parent_id: sprint5CategoryIds.food }),
  category({ id: sprint5CategoryIds.cardPayments, name: 'Pagamenti carta', type: 'expense' }),
  category({ id: sprint5CategoryIds.userB, user_id: sprint5UserBId, name: 'Categoria User B', type: 'expense' }),
]

export const sprint5Transactions: Transaction[] = [
  tx({ id: sprint5TransactionIds.oldIncome, type: 'income', amount: 2200, date: '2025-07-10', category_id: sprint5CategoryIds.salary, description: 'Stipendio storico' }),
  tx({ id: sprint5TransactionIds.oldExpense, type: 'expense', amount: 850, date: '2025-07-11', category_id: sprint5CategoryIds.rent, description: 'Affitto storico' }),
  tx({ id: sprint5TransactionIds.legacyOut, type: 'expense', amount: 300, date: '2025-12-20', transfer_peer_id: sprint5TransactionIds.legacyIn, description: 'Legacy transfer out' }),
  tx({ id: sprint5TransactionIds.legacyIn, account_id: sprint5AccountIds.savings, type: 'income', amount: 300, date: '2025-12-20', transfer_peer_id: sprint5TransactionIds.legacyOut, description: 'Legacy transfer in' }),
  tx({ id: sprint5TransactionIds.newTransfer, type: 'transfer', amount: 500, date: '2026-01-10', transfer_peer_id: sprint5AccountIds.savings, description: 'New transfer one-row' }),
  tx({ id: sprint5TransactionIds.uncategorized, type: 'expense', amount: 39.9, date: '2026-02-03', category_id: null, description: 'Senza categoria' }),
  tx({ id: sprint5TransactionIds.cardA, account_id: sprint5AccountIds.card, type: 'expense', amount: 45, date: '2026-03-05', category_id: sprint5CategoryIds.grocery, description: 'Carta importo duplicato A' }),
  tx({ id: sprint5TransactionIds.cardB, account_id: sprint5AccountIds.card, type: 'expense', amount: 45, date: '2026-03-05', category_id: sprint5CategoryIds.grocery, description: 'Carta importo duplicato B' }),
  tx({ id: sprint5TransactionIds.currentIncome, type: 'income', amount: 2450, date: '2026-07-05', category_id: sprint5CategoryIds.salary, description: 'Stipendio corrente' }),
  tx({ id: sprint5TransactionIds.currentExpense, type: 'expense', amount: 122.75, date: '2026-07-08', category_id: sprint5CategoryIds.grocery, description: 'Spesa corrente' }),
  tx({ id: sprint5TransactionIds.userB, user_id: sprint5UserBId, account_id: sprint5AccountIds.userB, category_id: sprint5CategoryIds.userB, type: 'expense', amount: 10, date: '2026-07-09', description: 'Movimento user B' }),
]

export const sprint5Expected = {
  userATransactionCount: 10,
  userBTransactionCount: 1,
  netWorthAfterFixture: 34750,
  currentMonthIncome: 2450,
  currentMonthExpense: 122.75,
  currentMonthNet: 2327.25,
}

export const sprint5FixtureSql = `
-- Sprint 5 deterministic fixture for a local Supabase database only.
-- Apply with psql against the local Supabase DB after migrations are loaded.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('${sprint5UserAId}', 'authenticated', 'authenticated', 'sprint5-a@example.local', crypt('Sprint5LocalOnly!', gen_salt('bf')), now(), now(), now()),
  ('${sprint5UserBId}', 'authenticated', 'authenticated', 'sprint5-b@example.local', crypt('Sprint5LocalOnly!', gen_salt('bf')), now(), now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, display_name, currency)
values
  ('${sprint5UserAId}', 'Sprint 5 User A', 'EUR'),
  ('${sprint5UserBId}', 'Sprint 5 User B', 'EUR')
on conflict (id) do update set display_name = excluded.display_name;

${sprint5Accounts.map((row) => `insert into public.accounts (id, user_id, name, type, balance, currency, is_active, is_hidden)
values ('${row.id}', '${row.user_id}', '${row.name}', '${row.type}', ${row.balance}, 'EUR', true, false)
on conflict (id) do update set balance = excluded.balance, name = excluded.name;`).join('\n')}

${sprint5Categories.map((row) => `insert into public.categories (id, user_id, name, type, color, parent_id, is_default)
values ('${row.id}', '${row.user_id}', '${row.name}', '${row.type}', '${row.color}', ${row.parent_id ? `'${row.parent_id}'` : 'null'}, false)
on conflict (id) do update set name = excluded.name, parent_id = excluded.parent_id;`).join('\n')}

delete from public.transactions where id in (${sprint5Transactions.map((row) => `'${row.id}'`).join(', ')});
${sprint5Transactions.map((row) => `insert into public.transactions (id, user_id, account_id, category_id, type, amount, description, notes, date, transfer_peer_id)
values ('${row.id}', '${row.user_id}', '${row.account_id}', ${row.category_id ? `'${row.category_id}'` : 'null'}, '${row.type}', ${row.amount}, '${row.description}', null, '${row.date}', ${row.transfer_peer_id ? `'${row.transfer_peer_id}'` : 'null'});`).join('\n')}
`

function account(overrides: Partial<Account>): Account {
  return {
    id: sprint5AccountIds.bank,
    user_id: sprint5UserAId,
    name: 'Sprint 5 Account',
    type: 'checking',
    color: '#6366f1',
    icon: null,
    balance: 0,
    currency: 'EUR',
    is_active: true,
    is_hidden: false,
    sort_order: 0,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

function category(overrides: Partial<Category>): Category {
  return {
    id: sprint5CategoryIds.home,
    user_id: sprint5UserAId,
    name: 'Categoria Sprint 5',
    type: 'expense',
    color: '#6366f1',
    icon: null,
    parent_id: null,
    is_default: false,
    sort_order: 0,
    created_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: sprint5TransactionIds.currentExpense,
    user_id: sprint5UserAId,
    account_id: sprint5AccountIds.bank,
    category_id: null,
    type: 'expense',
    amount: 0,
    description: 'Transazione Sprint 5',
    notes: null,
    date: '2026-07-01',
    transfer_peer_id: null,
    recurring_id: null,
    receipt_url: null,
    receipt_data: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}
