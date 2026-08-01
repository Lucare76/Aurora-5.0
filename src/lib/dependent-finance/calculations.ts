import type {
  AccountPurposeLink,
  AdiCategory,
  AdiEntry,
  AssetPurpose,
  AuroraTransferDirection,
  FinanceScope,
  MinimalAccount,
  MinimalTransaction,
} from './types'

type AccountScopeLink = { account_id: string; purpose: string | null | undefined }

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function amount(value: number | string): number {
  return Number(value) || 0
}

export function normalizeFinanceScope(purpose: AssetPurpose | string | null | undefined): FinanceScope {
  if (purpose === 'DEPENDENT' || purpose === 'DEPENDENT_AURORA') return 'DEPENDENT_AURORA'
  if (purpose === 'ADI') return 'ADI'
  return 'PERSONAL'
}

export function isPersonalScope(purpose: AssetPurpose | string | null | undefined): boolean {
  return normalizeFinanceScope(purpose) === 'PERSONAL'
}

export function isAuroraScope(purpose: AssetPurpose | string | null | undefined): boolean {
  return normalizeFinanceScope(purpose) === 'DEPENDENT_AURORA'
}

export function isAdiScope(purpose: AssetPurpose | string | null | undefined): boolean {
  return normalizeFinanceScope(purpose) === 'ADI'
}

export function getAccountScopeMap(
  links: AccountScopeLink[],
): Map<string, FinanceScope> {
  return new Map(links.map((link) => [link.account_id, normalizeFinanceScope(link.purpose)]))
}

export function getDependentAccountIds(links: AccountScopeLink[]): Set<string> {
  return getAccountIdsByScope(links, 'DEPENDENT_AURORA')
}

export function getAccountIdsByScope(
  links: AccountScopeLink[],
  scope: FinanceScope,
): Set<string> {
  return new Set(links.filter((link) => normalizeFinanceScope(link.purpose) === scope).map((link) => link.account_id))
}

export function filterAccountsByScope<T extends { id: string }>(
  accounts: T[],
  links: AccountScopeLink[],
  scope: FinanceScope,
): T[] {
  const scopedIds = getAccountIdsByScope(links, scope)
  if (scope === 'PERSONAL') {
    return accounts.filter((account) => !links.some((link) => link.account_id === account.id && normalizeFinanceScope(link.purpose) !== 'PERSONAL'))
  }
  return accounts.filter((account) => scopedIds.has(account.id))
}

export function filterPersonalAccounts<T extends { id: string }>(
  accounts: T[],
  links: AccountScopeLink[],
): T[] {
  return filterAccountsByScope(accounts, links, 'PERSONAL')
}

export function filterTransactionsByScope<T extends { account_id?: string | null }>(
  transactions: T[],
  links: AccountScopeLink[],
  scope: FinanceScope,
): T[] {
  const scopedIds = getAccountIdsByScope(links, scope)
  if (scope === 'PERSONAL') {
    const nonPersonalIds = new Set(links.filter((link) => normalizeFinanceScope(link.purpose) !== 'PERSONAL').map((link) => link.account_id))
    return transactions.filter((transaction) => !transaction.account_id || !nonPersonalIds.has(transaction.account_id))
  }
  return transactions.filter((transaction) => Boolean(transaction.account_id && scopedIds.has(transaction.account_id)))
}

export function filterPersonalTransactions<T extends { account_id?: string | null }>(
  transactions: T[],
  links: AccountScopeLink[],
): T[] {
  return filterTransactionsByScope(transactions, links, 'PERSONAL')
}

export function classifyTransferDirection(
  sourceAccountId: string,
  destinationAccountId: string | null | undefined,
  links: AccountScopeLink[],
): AuroraTransferDirection {
  const scopes = getAccountScopeMap(links)
  const sourceScope = scopes.get(sourceAccountId) ?? 'PERSONAL'
  const destinationScope = destinationAccountId ? scopes.get(destinationAccountId) ?? 'PERSONAL' : 'PERSONAL'
  if (sourceScope === 'DEPENDENT_AURORA' && destinationScope === 'DEPENDENT_AURORA') return 'AURORA_TO_AURORA'
  if (sourceScope === 'DEPENDENT_AURORA' && destinationScope === 'PERSONAL') return 'AURORA_TO_PERSONAL'
  if (sourceScope === 'PERSONAL' && destinationScope === 'DEPENDENT_AURORA') return 'PERSONAL_TO_AURORA'
  return 'PERSONAL_TO_PERSONAL'
}

export function buildAuroraAccountSummary(params: {
  account: MinimalAccount | null
  transactions: MinimalTransaction[]
  from?: string
  to?: string
}) {
  return buildAuroraScopeSummary({
    accounts: params.account ? [params.account] : [],
    transactions: params.transactions,
    links: params.account ? [{ account_id: params.account.id, purpose: 'DEPENDENT_AURORA' as const }] : [],
    from: params.from,
    to: params.to,
  })
}

export function buildAuroraScopeSummary(params: {
  accounts: MinimalAccount[]
  transactions: MinimalTransaction[]
    links: AccountScopeLink[]
  from?: string
  to?: string
}) {
  const auroraIds = new Set(params.accounts.map((account) => account.id))
  const txs = params.transactions
    .filter((tx) => (tx.account_id && auroraIds.has(tx.account_id)) || (tx.transfer_peer_id && auroraIds.has(tx.transfer_peer_id)))
    .filter((tx) => !params.from || tx.date >= params.from)
    .filter((tx) => !params.to || tx.date <= params.to)
    .sort((a, b) => b.date.localeCompare(a.date))

  let income = 0
  let expenses = 0
  let personalTransfersIn = 0
  let personalTransfersOut = 0
  let internalTransfers = 0
  const incomeByCategory = new Map<string, number>()
  const expenseByCategory = new Map<string, number>()

  for (const tx of txs) {
    const value = amount(tx.amount)
    const direction = tx.type === 'transfer' || tx.transfer_peer_id
      ? classifyTransferDirection(tx.account_id ?? '', tx.destination_account_id ?? tx.transfer_peer_id, params.links)
      : null

    if (direction === 'AURORA_TO_AURORA') {
      internalTransfers = round2(internalTransfers + value)
      continue
    }
    if (direction === 'PERSONAL_TO_AURORA' || (tx.type === 'income' && tx.transfer_peer_id)) {
      personalTransfersIn = round2(personalTransfersIn + value)
      continue
    }
    if (direction === 'AURORA_TO_PERSONAL' || (tx.type === 'expense' && tx.transfer_peer_id)) {
      personalTransfersOut = round2(personalTransfersOut + value)
      continue
    }
    if (tx.type === 'income') {
      income = round2(income + value)
      const key = tx.category_id ?? 'Senza categoria'
      incomeByCategory.set(key, round2((incomeByCategory.get(key) ?? 0) + value))
    }
    if (tx.type === 'expense') {
      expenses = round2(expenses + value)
      const key = tx.category_id ?? 'Senza categoria'
      expenseByCategory.set(key, round2((expenseByCategory.get(key) ?? 0) + value))
    }
  }

  const monthly = new Map<string, { month: string; income: number; expenses: number; transfersIn: number; transfersOut: number; balance: number }>()
  for (const tx of txs) {
    const key = tx.date.slice(0, 7)
    const row = monthly.get(key) ?? { month: key, income: 0, expenses: 0, transfersIn: 0, transfersOut: 0, balance: 0 }
    const value = amount(tx.amount)
    const direction = tx.type === 'transfer' || tx.transfer_peer_id
      ? classifyTransferDirection(tx.account_id ?? '', tx.destination_account_id ?? tx.transfer_peer_id, params.links)
      : null
    if (direction === 'PERSONAL_TO_AURORA') row.transfersIn = round2(row.transfersIn + value)
    else if (direction === 'AURORA_TO_PERSONAL') row.transfersOut = round2(row.transfersOut + value)
    else if (direction !== 'AURORA_TO_AURORA' && tx.type === 'income') row.income = round2(row.income + value)
    else if (direction !== 'AURORA_TO_AURORA' && tx.type === 'expense') row.expenses = round2(row.expenses + value)
    row.balance = round2(row.income + row.transfersIn - row.expenses - row.transfersOut)
    monthly.set(key, row)
  }

  const balance = round2(params.accounts.filter((account) => account.is_active !== false).reduce((sum, account) => sum + amount(account.balance), 0))
  const byAccount = params.accounts.map((account) => ({
    accountId: account.id,
    name: account.name,
    type: account.type ?? 'other',
    currency: account.currency,
    balance: round2(amount(account.balance)),
    share: balance > 0 ? round2((amount(account.balance) / balance) * 100) : 0,
    isActive: account.is_active !== false,
  }))

  return {
    balance,
    liquidity: round2(params.accounts.filter((account) => account.is_active !== false && account.type !== 'investment').reduce((sum, account) => sum + amount(account.balance), 0)),
    investments: round2(params.accounts.filter((account) => account.is_active !== false && account.type === 'investment').reduce((sum, account) => sum + amount(account.balance), 0)),
    income,
    expenses,
    transfersIn: personalTransfersIn,
    transfersOut: personalTransfersOut,
    internalTransfers,
    totalContributions: round2(income + personalTransfersIn),
    totalWithdrawn: round2(expenses + personalTransfersOut),
    periodChange: round2(income + personalTransfersIn - expenses - personalTransfersOut),
    activeAccountsCount: params.accounts.filter((account) => account.is_active !== false).length,
    lastMovementDate: txs[0]?.date ?? null,
    lastMovement: txs[0] ?? null,
    byAccount,
    incomeByCategory: [...incomeByCategory.entries()].map(([categoryId, total]) => ({ categoryId, total })),
    expenseByCategory: [...expenseByCategory.entries()].map(([categoryId, total]) => ({ categoryId, total })),
    monthlyTrend: [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12),
    recentTransactions: txs.slice(0, 20),
  }
}

export function buildAdiSummary(entries: Pick<AdiEntry, 'entry_type' | 'adi_category' | 'amount' | 'date' | 'reference_period'>[]) {
  const received = round2(entries.filter((entry) => entry.entry_type === 'credit').reduce((sum, entry) => sum + amount(entry.amount), 0))
  const spent = round2(entries.filter((entry) => entry.entry_type === 'debit').reduce((sum, entry) => sum + amount(entry.amount), 0))
  const byCategory = {
    SUPERMERCATO: 0,
    BENZINA: 0,
    ABBIGLIAMENTO_AURORA: 0,
  } satisfies Record<AdiCategory, number>

  for (const entry of entries) {
    if (entry.entry_type === 'debit' && entry.adi_category) {
      byCategory[entry.adi_category] = round2(byCategory[entry.adi_category] + amount(entry.amount))
    }
  }

  const monthly = new Map<string, { month: string; received: number; spent: number; balance: number }>()
  for (const entry of entries) {
    const key = entry.reference_period ?? entry.date.slice(0, 7)
    const row = monthly.get(key) ?? { month: key, received: 0, spent: 0, balance: 0 }
    if (entry.entry_type === 'credit') row.received = round2(row.received + amount(entry.amount))
    if (entry.entry_type === 'debit') row.spent = round2(row.spent + amount(entry.amount))
    row.balance = round2(row.received - row.spent)
    monthly.set(key, row)
  }

  return {
    received,
    spent,
    balance: round2(received - spent),
    utilizationRate: received > 0 ? round2((spent / received) * 100) : 0,
    byCategory,
    monthlyTrend: [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)),
  }
}

export function canRegisterAdiDebit(currentBalance: number, debitAmount: number): boolean {
  return debitAmount > 0 && round2(currentBalance - debitAmount) >= 0
}
