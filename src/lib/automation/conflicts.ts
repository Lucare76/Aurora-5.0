import type { AutomationRule, AutomationTransactionPatch, RuleEvaluation } from './types'

export function sortRulesForEvaluation(rules: AutomationRule[]): AutomationRule[] {
  return [...rules].sort((a, b) =>
    a.priority - b.priority ||
    a.created_at.localeCompare(b.created_at) ||
    a.id.localeCompare(b.id),
  )
}

export function detectSamePriorityConflicts(evaluations: RuleEvaluation[]): string[] {
  const conflicts: string[] = []
  const byPriority = new Map<number, RuleEvaluation[]>()
  for (const evaluation of evaluations.filter((item) => item.matched && !item.skippedReason)) {
    byPriority.set(evaluation.rule.priority, [...(byPriority.get(evaluation.rule.priority) ?? []), evaluation])
  }

  for (const [priority, items] of byPriority) {
    const seen = new Map<keyof AutomationTransactionPatch, unknown>()
    for (const item of items) {
      for (const [field, value] of Object.entries(item.changes) as Array<[keyof AutomationTransactionPatch, unknown]>) {
        if (seen.has(field) && seen.get(field) !== value) conflicts.push(`PRIORITY_${priority}_${String(field).toUpperCase()}`)
        seen.set(field, value)
      }
    }
  }
  return [...new Set(conflicts)]
}
