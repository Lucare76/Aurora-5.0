import type { ScenarioActionCode } from './types'

// ── Engine versions ───────────────────────────────────────────────────────────

export const SCENARIO_ENGINE_VERSION = '1.0.0'
export const SCENARIO_SCHEMA_VERSION = 1
export const SCENARIO_ACTION_REGISTRY_VERSION = '1.0.0'
export const SCENARIO_RESULT_SUMMARY_VERSION = 1

// ── Limits ────────────────────────────────────────────────────────────────────

export const MAX_HORIZON_MONTHS = 60
export const DEFAULT_HORIZON_MONTHS = 12
export const MAX_ACTIONS_PER_SCENARIO = 50
export const MAX_SCENARIOS_PER_USER = 100
export const MAX_SCENARIOS_COMPARE = 3
export const MAX_SCENARIO_NAME_LENGTH = 100
export const MAX_SCENARIO_DESCRIPTION_LENGTH = 500
export const MAX_ACTION_LABEL_LENGTH = 100

// ── Valid values ──────────────────────────────────────────────────────────────

export const SCENARIO_STATUSES = ['draft', 'ready', 'outdated', 'archived'] as const

export const ACTION_CODES: readonly ScenarioActionCode[] = [
  'ONE_TIME_EXPENSE',
  'RECURRING_EXPENSE_ADD',
  'RECURRING_EXPENSE_UPDATE',
  'RECURRING_EXPENSE_REMOVE',
  'RECURRING_INCOME_ADD',
  'RECURRING_INCOME_REDUCE',
  'RECURRING_INCOME_PAUSE',
  'MONTHLY_SAVINGS_CHANGE',
  'CATEGORY_SPENDING_CHANGE',
  'BUDGET_LIMIT_CHANGE',
  'GOAL_CONTRIBUTION_CHANGE',
  'GOAL_DEADLINE_CHANGE',
  'GOAL_ONE_TIME_CONTRIBUTION',
  'LOAN_EARLY_PAYOFF',
  'NEW_LOAN',
  'ACCOUNT_BALANCE_ADJUSTMENT',
]

// ── Contribution lookback ─────────────────────────────────────────────────────

// How many months back to compute average goal/loan contributions
export const CONTRIBUTION_LOOKBACK_MONTHS = 3

// Minimum number of contributions to consider the average meaningful
export const MIN_CONTRIBUTIONS_FOR_AVERAGE = 1

// Minimum amount for a recurring rule to be included in projection
export const MIN_RECURRING_AMOUNT = 0.01

// ── Italian month labels ──────────────────────────────────────────────────────

export const MONTH_LABELS_IT = [
  'gen', 'feb', 'mar', 'apr', 'mag', 'giu',
  'lug', 'ago', 'set', 'ott', 'nov', 'dic',
] as const

// ── UI text ───────────────────────────────────────────────────────────────────

export const DISCLAIMER_TEXT =
  'Le proiezioni si basano sui dati e sulle ipotesi attualmente disponibili e non rappresentano una garanzia del risultato futuro.'

export const SIMULATION_BADGE = 'Simulazione — nessuna modifica ai dati reali'

export const SIMULATED_HEALTH_NOTE = 'Punteggio simulato (approssimazione)'
