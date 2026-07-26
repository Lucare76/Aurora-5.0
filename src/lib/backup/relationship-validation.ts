import { issue } from './issue'
import type { AuroraBackupV1, BackupValidationIssue } from './types'

export function validateBackupRelationships(backup: AuroraBackupV1): BackupValidationIssue[] {
  const issues: BackupValidationIssue[] = []
  const accountIds = new Set(backup.data.accounts.map((account) => account.id))
  const categoryIds = new Set(backup.data.categories.map((category) => category.id))
  const transactionIds = new Set(backup.data.transactions.map((transaction) => transaction.id))
  const automationRuleIds = new Set(backup.data.automationRules.map((rule) => rule.id))
  const automationBatchIds = new Set(backup.data.automationApplicationBatches.map((batch) => batch.id))
  const loanIds = new Set(backup.data.loans.map((loan) => loan.id))
  const birthdayIds = new Set(backup.data.birthdays.map((birthday) => birthday.id))

  backup.data.categories.forEach((category, index) => {
    if (category.parent_id === category.id) {
      issues.push(issue('CATEGORY_SELF_REFERENCE', 'error', ['data', 'categories', index, 'parent_id'], 'Una categoria non puo essere padre di se stessa.'))
    } else if (category.parent_id && !categoryIds.has(category.parent_id)) {
      issues.push(issue('CATEGORY_PARENT_MISSING', 'error', ['data', 'categories', index, 'parent_id'], 'Categoria padre mancante.'))
    }
  })
  issues.push(...detectCategoryCycles(backup))

  backup.data.transactions.forEach((transaction, index) => {
    if (!accountIds.has(transaction.account_id)) {
      issues.push(issue('TRANSACTION_ACCOUNT_MISSING', 'error', ['data', 'transactions', index, 'account_id'], 'Conto della transazione mancante.'))
    }
    if (transaction.category_id && !categoryIds.has(transaction.category_id)) {
      issues.push(issue('TRANSACTION_CATEGORY_MISSING', 'error', ['data', 'transactions', index, 'category_id'], 'Categoria della transazione mancante.'))
    }
    if (transaction.transfer_peer_id) {
      const pointsToAccount = accountIds.has(transaction.transfer_peer_id)
      const pointsToTransaction = transactionIds.has(transaction.transfer_peer_id)
      if (!pointsToAccount && !pointsToTransaction) {
        issues.push(issue('TRANSFER_PEER_MISSING', 'error', ['data', 'transactions', index, 'transfer_peer_id'], 'Riferimento trasferimento mancante.'))
      } else if (pointsToTransaction) {
        const peer = backup.data.transactions.find((row) => row.id === transaction.transfer_peer_id)
        if (peer?.transfer_peer_id !== transaction.id) {
          issues.push(issue('TRANSFER_PEER_INCOHERENT', 'error', ['data', 'transactions', index, 'transfer_peer_id'], 'Trasferimento legacy con peer non reciproco.'))
        } else {
          issues.push(issue('LEGACY_TRANSFER_REFERENCE', 'info', ['data', 'transactions', index, 'transfer_peer_id'], 'Trasferimento legacy a due righe rilevato.'))
        }
      }
    }
  })

  backup.data.budgets.forEach((budget, index) => {
    if (!categoryIds.has(budget.category_id)) {
      issues.push(issue('BUDGET_CATEGORY_MISSING', 'error', ['data', 'budgets', index, 'category_id'], 'Categoria del budget mancante.'))
    }
  })

  backup.data.recurringRules.forEach((rule, index) => {
    if (!accountIds.has(rule.account_id)) {
      issues.push(issue('RECURRING_ACCOUNT_MISSING', 'error', ['data', 'recurringRules', index, 'account_id'], 'Conto della ricorrenza mancante.'))
    }
    if (rule.category_id && !categoryIds.has(rule.category_id)) {
      issues.push(issue('RECURRING_CATEGORY_MISSING', 'error', ['data', 'recurringRules', index, 'category_id'], 'Categoria della ricorrenza mancante.'))
    }
  })

  backup.data.loanPayments.forEach((payment, index) => {
    if (!loanIds.has(payment.loan_id)) {
      issues.push(issue('LOAN_PAYMENT_LOAN_MISSING', 'error', ['data', 'loanPayments', index, 'loan_id'], 'Prestito del pagamento mancante.'))
    }
  })

  backup.data.birthdayReminderLog.forEach((row, index) => {
    if (!birthdayIds.has(row.birthday_id)) {
      issues.push(issue('BIRTHDAY_REMINDER_BIRTHDAY_MISSING', 'error', ['data', 'birthdayReminderLog', index, 'birthday_id'], 'Compleanno del reminder mancante.'))
    }
  })

  backup.data.automationRules.forEach((rule, index) => {
    rule.actions.forEach((action, actionIndex) => {
      if (action.type === 'set_account' && !accountIds.has(action.account_id)) {
        issues.push(issue('AUTOMATION_ACCOUNT_MISSING', 'error', ['data', 'automationRules', index, 'actions', actionIndex, 'account_id'], 'Conto della regola automazione mancante.'))
      }
      if (action.type === 'set_category' && action.category_id && !categoryIds.has(action.category_id)) {
        issues.push(issue('AUTOMATION_CATEGORY_MISSING', 'error', ['data', 'automationRules', index, 'actions', actionIndex, 'category_id'], 'Categoria della regola automazione mancante.'))
      }
    })
  })

  backup.data.automationApplicationBatches.forEach((batch, index) => {
    if (batch.rule_id && !automationRuleIds.has(batch.rule_id)) {
      issues.push(issue('AUTOMATION_BATCH_RULE_MISSING', 'warning', ['data', 'automationApplicationBatches', index, 'rule_id'], 'Regola del batch automazione mancante.'))
    }
  })

  backup.data.automationRuleApplications.forEach((application, index) => {
    if (application.rule_id && !automationRuleIds.has(application.rule_id)) {
      issues.push(issue('AUTOMATION_APPLICATION_RULE_MISSING', 'warning', ['data', 'automationRuleApplications', index, 'rule_id'], 'Regola dell’applicazione automazione mancante.'))
    }
    if (application.transaction_id && !transactionIds.has(application.transaction_id)) {
      issues.push(issue('AUTOMATION_APPLICATION_TRANSACTION_MISSING', 'warning', ['data', 'automationRuleApplications', index, 'transaction_id'], 'Movimento dell’applicazione automazione mancante.'))
    }
    if (application.application_batch_id && !automationBatchIds.has(application.application_batch_id)) {
      issues.push(issue('AUTOMATION_APPLICATION_BATCH_MISSING', 'warning', ['data', 'automationRuleApplications', index, 'application_batch_id'], 'Batch dell’applicazione automazione mancante.'))
    }
  })

  return issues
}

function detectCategoryCycles(backup: AuroraBackupV1): BackupValidationIssue[] {
  const issues: BackupValidationIssue[] = []
  const byId = new Map(backup.data.categories.map((category) => [category.id, category]))
  backup.data.categories.forEach((category, index) => {
    const visited = new Set<string>()
    let current = category.parent_id
    while (current) {
      if (visited.has(current) || current === category.id) {
        issues.push(issue('CATEGORY_CYCLE', 'error', ['data', 'categories', index, 'parent_id'], 'Ciclo tra categorie rilevato.'))
        break
      }
      visited.add(current)
      current = byId.get(current)?.parent_id ?? null
    }
  })
  return issues
}
