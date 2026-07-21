import type { AuroraBackupV1 } from '../types'
import type { DryRunIssue, RestorePlan, RestorePlanStep } from './types'

// Plan steps use semantic names ('parentCategories', 'childCategories',
// 'normalTransactions', 'transferTransactions') while DryRunIssue paths use
// the canonical DB collection key ('categories', 'transactions').
// This mapping ensures issues are correctly attributed to their plan steps.
function collectionAliases(collection: string): string[] {
  if (collection === 'parentCategories' || collection === 'childCategories') return [collection, 'categories']
  if (collection === 'normalTransactions' || collection === 'transferTransactions') return [collection, 'transactions']
  return [collection]
}

export function buildRestorePlan(backup: AuroraBackupV1, issues: DryRunIssue[] = []): RestorePlan {
  const steps: RestorePlanStep[] = [
    step(1, 'profile', 1, []),
    step(2, 'accounts', backup.data.accounts.length, ['profile']),
    step(3, 'parentCategories', backup.data.categories.filter((category) => !category.parent_id).length, ['profile']),
    step(4, 'childCategories', backup.data.categories.filter((category) => category.parent_id).length, ['parentCategories']),
    step(5, 'loans', backup.data.loans.length, ['profile']),
    step(6, 'recurringRules', backup.data.recurringRules.length, ['accounts', 'categories']),
    step(7, 'normalTransactions', backup.data.transactions.filter((tx) => tx.type !== 'transfer').length, ['accounts', 'categories']),
    step(8, 'transferTransactions', backup.data.transactions.filter((tx) => tx.type === 'transfer').length, ['accounts']),
    step(9, 'loanPayments', backup.data.loanPayments.length, ['loans']),
    step(10, 'budgets', backup.data.budgets.length, ['categories']),
    step(11, 'birthdays', backup.data.birthdays.length, ['profile']),
    step(12, 'birthdayReminderLog', backup.data.birthdayReminderLog.length, ['birthdays']),
    step(13, 'auditLogs', backup.data.auditLogs.length, ['profile']),
  ]

  const enriched = steps.map((item) => {
    const aliases = collectionAliases(item.collection)
    const relatedIssues = issues.filter((issue) => aliases.some((alias) => issue.path.includes(alias)))
    const blockingIssues = relatedIssues.filter((issue) => issue.severity === 'error').map((issue) => issue.code)
    const warnings = relatedIssues.filter((issue) => issue.severity === 'warning').map((issue) => issue.code)
    return {
      ...item,
      status: blockingIssues.length > 0 ? 'blocked' : warnings.length > 0 ? 'warning' : 'ready',
      blockingIssues,
      warnings,
    } satisfies RestorePlanStep
  })

  return {
    mode: 'empty_account_restore',
    steps: enriched,
  }
}

function step(
  sequence: number,
  collection: string,
  recordCount: number,
  dependencies: string[],
): RestorePlanStep {
  return {
    sequence,
    collection,
    operation: 'simulate_create',
    recordCount,
    dependencies,
    status: 'ready',
    blockingIssues: [],
    warnings: [],
  }
}
