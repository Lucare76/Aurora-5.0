import type {
  FinancialScenario,
  ScenarioValidationResult,
  ScenarioValidationIssue,
  ScenarioActionCode,
} from './types'
import { MAX_ACTIONS_PER_SCENARIO, MAX_HORIZON_MONTHS } from './constants'
import { isKnownActionCode } from './registry'

// Actions that cannot coexist for the same entity
const MUTUALLY_EXCLUSIVE_PAIRS: Array<[ScenarioActionCode, ScenarioActionCode]> = [
  ['RECURRING_EXPENSE_UPDATE', 'RECURRING_EXPENSE_REMOVE'],
  ['RECURRING_INCOME_REDUCE', 'RECURRING_INCOME_PAUSE'],
]

export function validateScenario(scenario: FinancialScenario): ScenarioValidationResult {
  const issues: ScenarioValidationIssue[] = []

  // Horizon bounds
  if (scenario.horizon_months < 1 || scenario.horizon_months > MAX_HORIZON_MONTHS) {
    issues.push({
      code: 'INVALID_HORIZON',
      severity: 'error',
      message: `L'orizzonte deve essere compreso tra 1 e ${MAX_HORIZON_MONTHS} mesi.`,
    })
  }

  // Action count cap
  if (scenario.actions.length > MAX_ACTIONS_PER_SCENARIO) {
    issues.push({
      code: 'TOO_MANY_ACTIONS',
      severity: 'error',
      message: `Massimo ${MAX_ACTIONS_PER_SCENARIO} azioni per scenario.`,
    })
  }

  // Per-action checks
  for (const action of scenario.actions) {
    if (!isKnownActionCode(action.code)) {
      issues.push({
        code: 'UNKNOWN_ACTION_CODE',
        severity: 'error',
        actionId: action.id,
        message: `Codice azione sconosciuto: "${action.code}".`,
      })
    }
  }

  // Detect conflicting pairs on the same ruleId/loanId/goalId
  const enabledActions = scenario.actions.filter((a) => a.enabled)

  for (const [codeA, codeB] of MUTUALLY_EXCLUSIVE_PAIRS) {
    const groupA = enabledActions.filter((a) => a.code === codeA)
    const groupB = enabledActions.filter((a) => a.code === codeB)
    for (const a of groupA) {
      for (const b of groupB) {
        const aEntity = (a.params as Record<string, unknown>).ruleId ?? (a.params as Record<string, unknown>).loanId ?? (a.params as Record<string, unknown>).goalId
        const bEntity = (b.params as Record<string, unknown>).ruleId ?? (b.params as Record<string, unknown>).loanId ?? (b.params as Record<string, unknown>).goalId
        if (aEntity && aEntity === bEntity) {
          issues.push({
            code: 'CONFLICTING_ACTIONS',
            severity: 'warning',
            actionId: b.id,
            message: `Azioni "${codeA}" e "${codeB}" in conflitto per la stessa entità.`,
          })
        }
      }
    }
  }

  // Duplicate action codes for same entity (warn, not error)
  const seenByEntity = new Map<string, string>()
  for (const action of enabledActions) {
    const entityKey = [
      action.code,
      (action.params as Record<string, unknown>).ruleId ?? '',
      (action.params as Record<string, unknown>).loanId ?? '',
      (action.params as Record<string, unknown>).goalId ?? '',
    ].join('|')
    if (seenByEntity.has(entityKey)) {
      issues.push({
        code: 'DUPLICATE_ACTION',
        severity: 'warning',
        actionId: action.id,
        message: `Azione duplicata per la stessa entità (${action.code}).`,
      })
    } else {
      seenByEntity.set(entityKey, action.id)
    }
  }

  return {
    valid: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
  }
}
