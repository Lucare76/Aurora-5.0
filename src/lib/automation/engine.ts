import { applyRuleActions, diffPatch } from './actions'
import { detectSamePriorityConflicts, sortRulesForEvaluation } from './conflicts'
import { matchesCondition } from './matcher'
import type {
  AutomationEvaluationResult,
  AutomationPreviewRow,
  AutomationReferences,
  AutomationRule,
  AutomationTransaction,
  AutomationTransactionPatch,
  RuleEvaluation,
} from './types'

export const MAX_ACTIVE_RULES_PER_EVALUATION = 100

function ruleExplicitlyTargetsTransfer(rule: AutomationRule): boolean {
  return rule.conditions.some((condition) => condition.type === 'transaction_type' && condition.value === 'transfer')
}

export function matchesRule(rule: AutomationRule, transaction: AutomationTransaction, references: AutomationReferences): RuleEvaluation {
  if (!rule.is_active) return { rule, matched: false, conditions: [], changes: {}, conflicts: [], skippedReason: 'RULE_INACTIVE' }
  if (rule.archived) return { rule, matched: false, conditions: [], changes: {}, conflicts: [], skippedReason: 'RULE_ARCHIVED' }
  if (transaction.type === 'transfer' && !ruleExplicitlyTargetsTransfer(rule)) {
    return { rule, matched: false, conditions: [], changes: {}, conflicts: [], skippedReason: 'TRANSFER_NOT_EXPLICIT' }
  }

  const conditions = rule.conditions.map((condition) => matchesCondition(condition, transaction))
  const matched = rule.match_mode === 'ALL'
    ? conditions.every((condition) => condition.matched)
    : conditions.some((condition) => condition.matched)

  if (!matched) return { rule, matched, conditions, changes: {}, conflicts: [], skippedReason: null }

  const actionResult = applyRuleActions(transaction, rule.actions, references)
  return {
    rule,
    matched,
    conditions,
    changes: actionResult.changes,
    conflicts: actionResult.conflicts,
    skippedReason: actionResult.skippedReason,
  }
}

export function evaluateRules(
  transaction: AutomationTransaction,
  rules: AutomationRule[],
  references: AutomationReferences,
  options: { automaticOnly?: boolean } = {},
): AutomationEvaluationResult {
  const sorted = sortRulesForEvaluation(rules)
    .filter((rule) => !options.automaticOnly || rule.apply_to_new_transactions)
    .slice(0, MAX_ACTIVE_RULES_PER_EVALUATION)

  const evaluations: RuleEvaluation[] = []
  const suggestedChanges: Partial<AutomationTransactionPatch> = {}
  const appliedRules: AutomationRule[] = []
  const conflicts: string[] = []

  for (const rule of sorted) {
    const evaluation = matchesRule(rule, transaction, references)
    evaluations.push(evaluation)
    if (!evaluation.matched || evaluation.skippedReason) continue

    let hasConflict = false
    for (const [field, value] of Object.entries(evaluation.changes) as Array<[keyof AutomationTransactionPatch, unknown]>) {
      if (field in suggestedChanges && suggestedChanges[field] !== value) {
        conflicts.push(`CONFLICT_${String(field).toUpperCase()}`)
        hasConflict = true
      }
    }
    if (hasConflict || evaluation.conflicts.length > 0) {
      conflicts.push(...evaluation.conflicts)
      continue
    }

    for (const [field, value] of Object.entries(evaluation.changes) as Array<[keyof AutomationTransactionPatch, unknown]>) {
      if (!(field in suggestedChanges)) (suggestedChanges as Record<string, unknown>)[field] = value
    }
    appliedRules.push(rule)
    if (rule.stop_processing) break
  }

  conflicts.push(...detectSamePriorityConflicts(evaluations))
  return { evaluations, suggestedChanges, appliedRules, conflicts: [...new Set(conflicts)] }
}

export function buildSuggestedChanges(
  transaction: AutomationTransaction,
  rules: AutomationRule[],
  references: AutomationReferences,
  options: { automaticOnly?: boolean } = {},
) {
  return evaluateRules(transaction, rules, references, options).suggestedChanges
}

export function calculateRulePreview(
  rule: AutomationRule,
  transactions: AutomationTransaction[],
  references: AutomationReferences,
): AutomationPreviewRow[] {
  return transactions
    .map((transaction) => {
      const evaluation = matchesRule(rule, transaction, references)
      const { previousValues, appliedValues } = diffPatch(transaction, evaluation.changes)
      return { transaction, evaluation, previousValues, appliedValues }
    })
    .filter((row) => row.evaluation.matched)
}
