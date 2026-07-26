import type {
  AutomationAction,
  AutomationReferences,
  AutomationTransaction,
  AutomationTransactionPatch,
} from './types'

function addChange(
  changes: Partial<AutomationTransactionPatch>,
  field: keyof AutomationTransactionPatch,
  value: AutomationTransactionPatch[typeof field],
  conflicts: string[],
) {
  if (field in changes && changes[field] !== value) {
    conflicts.push(`CONFLICT_${field.toUpperCase()}`)
    return
  }
  ;(changes as Record<string, unknown>)[field] = value
}

export function validateActionReferences(action: AutomationAction, references: AutomationReferences): string | null {
  if (action.type === 'set_account') {
    const account = references.accounts.find((item) => item.id === action.account_id)
    if (!account || !account.is_active || account.is_hidden) return 'INVALID_ACCOUNT'
  }
  if (action.type === 'set_category' && action.category_id) {
    const category = references.categories.find((item) => item.id === action.category_id)
    if (!category) return 'INVALID_CATEGORY'
  }
  return null
}

export function applyRuleActions(
  transaction: AutomationTransaction,
  actions: AutomationAction[],
  references: AutomationReferences,
): { changes: Partial<AutomationTransactionPatch>; conflicts: string[]; skippedReason: string | null } {
  const changes: Partial<AutomationTransactionPatch> = {}
  const conflicts: string[] = []
  const isTransfer = transaction.type === 'transfer'

  for (const action of actions) {
    const referenceError = validateActionReferences(action, references)
    if (referenceError) return { changes, conflicts, skippedReason: referenceError }

    if (isTransfer && (action.type === 'set_account' || action.type === 'set_category' || action.type === 'set_transaction_type')) {
      return { changes, conflicts, skippedReason: 'TRANSFER_PROTECTED' }
    }

    if (action.type === 'set_category') addChange(changes, 'category_id', action.category_id, conflicts)
    if (action.type === 'set_account') addChange(changes, 'account_id', action.account_id, conflicts)
    if (action.type === 'set_transaction_type') addChange(changes, 'type', action.transaction_type, conflicts)
    if (action.type === 'normalize_description') addChange(changes, 'description', action.description, conflicts)
    if (action.type === 'append_note') {
      const current = transaction.notes?.trim()
      const next = current ? `${current}\n${action.note}` : action.note
      addChange(changes, 'notes', next, conflicts)
    }
  }

  return { changes, conflicts, skippedReason: conflicts.length ? 'CONFLICTING_ACTIONS' : null }
}

export function diffPatch(transaction: AutomationTransaction, changes: Partial<AutomationTransactionPatch>): {
  previousValues: Partial<AutomationTransactionPatch>
  appliedValues: Partial<AutomationTransactionPatch>
} {
  const previousValues: Partial<AutomationTransactionPatch> = {}
  const appliedValues: Partial<AutomationTransactionPatch> = {}
  for (const key of Object.keys(changes) as Array<keyof AutomationTransactionPatch>) {
    if (transaction[key] !== changes[key]) {
      ;(previousValues as Record<string, unknown>)[key] = transaction[key]
      ;(appliedValues as Record<string, unknown>)[key] = changes[key]
    }
  }
  return { previousValues, appliedValues }
}
