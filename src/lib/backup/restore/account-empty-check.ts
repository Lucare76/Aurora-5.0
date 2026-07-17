import type { AccountEmptyResult, CurrentUserDataSnapshot } from './types'

const BLOCKING_COLLECTIONS = [
  'accounts',
  'transactions',
  'budgets',
  'recurringRules',
  'loans',
  'loanPayments',
  'birthdays',
] as const

export function checkAccountEmpty(snapshot: CurrentUserDataSnapshot): AccountEmptyResult {
  const nonDefaultCategories = snapshot.categories.filter((category) => category.is_default !== true)
  const counts = {
    profile: snapshot.profileExists ? 1 : 0,
    accounts: snapshot.accounts.length,
    categories: nonDefaultCategories.length,
    transactions: snapshot.transactions.length,
    budgets: snapshot.budgets.length,
    recurringRules: snapshot.recurringRules.length,
    loans: snapshot.loans.length,
    loanPayments: snapshot.loanPayments.length,
    birthdays: snapshot.birthdays.length,
    birthdayReminderLog: snapshot.birthdayReminderLog.length,
    auditLogs: snapshot.auditLogs.length,
  }

  const blockingCollections = [
    ...BLOCKING_COLLECTIONS.filter((collection) => counts[collection] > 0),
    ...(counts.categories > 0 ? ['categories'] : []),
  ].sort()

  const ignoredCollections = [
    ...(snapshot.profileExists ? ['profile'] : []),
    ...(snapshot.categories.length > nonDefaultCategories.length ? ['defaultCategories'] : []),
    ...(snapshot.auditLogs.length > 0 ? ['auditLogs'] : []),
    ...(snapshot.birthdayReminderLog.length > 0 ? ['birthdayReminderLog'] : []),
  ]

  return {
    isEmpty: blockingCollections.length === 0,
    blockingCollections,
    ignoredCollections,
    counts,
  }
}
