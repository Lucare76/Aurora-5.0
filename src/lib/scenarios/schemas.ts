import { z } from 'zod'
import {
  MAX_ACTIONS_PER_SCENARIO,
  MAX_HORIZON_MONTHS,
  MAX_SCENARIO_DESCRIPTION_LENGTH,
  MAX_SCENARIO_NAME_LENGTH,
  MAX_ACTION_LABEL_LENGTH,
  ACTION_CODES,
  SCENARIO_STATUSES,
} from './constants'

// ── Shared validators ─────────────────────────────────────────────────────────

const positiveAmount = z.number().positive().finite()
const nonNegativeAmount = z.number().min(0).finite()
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato data non valido (YYYY-MM-DD)')
const recurringFrequency = z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'])

// ── Action param schemas ──────────────────────────────────────────────────────

export const oneTimeExpenseParamsSchema = z.object({
  amount: positiveAmount,
  date: isoDate,
  description: z.string().min(1).max(200),
  categoryId: z.string().uuid().nullable().optional(),
  linkedNewLoanActionId: z.string().nullable().optional(),
})

export const recurringExpenseAddParamsSchema = z.object({
  amount: positiveAmount,
  frequency: recurringFrequency,
  description: z.string().min(1).max(200),
  startDate: isoDate,
  endDate: isoDate.nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
})

export const recurringExpenseUpdateParamsSchema = z.object({
  ruleId: z.string().uuid(),
  newAmount: positiveAmount,
  startDate: isoDate,
  endDate: isoDate.nullable().optional(),
})

export const recurringExpenseRemoveParamsSchema = z.object({
  ruleId: z.string().uuid(),
  startDate: isoDate,
})

export const recurringIncomeAddParamsSchema = z.object({
  amount: positiveAmount,
  frequency: recurringFrequency,
  description: z.string().min(1).max(200),
  startDate: isoDate,
  endDate: isoDate.nullable().optional(),
})

export const recurringIncomeReduceParamsSchema = z.object({
  ruleId: z.string().uuid().nullable().optional(),
  reductionAmount: positiveAmount,
  startDate: isoDate,
  endDate: isoDate.nullable().optional(),
})

export const recurringIncomePauseParamsSchema = z.object({
  ruleId: z.string().uuid().nullable().optional(),
  startDate: isoDate,
  endDate: isoDate,
}).refine((d) => d.endDate >= d.startDate, {
  message: 'endDate deve essere successiva a startDate',
  path: ['endDate'],
})

export const monthlySavingsChangeParamsSchema = z.object({
  changeAmount: z.number().finite().refine((v) => v !== 0, 'Importo non può essere zero'),
  startDate: isoDate,
  endDate: isoDate.nullable().optional(),
})

export const categorySpendingChangeParamsSchema = z.object({
  categoryId: z.string().uuid(),
  changeAmount: z.number().finite().refine((v) => v !== 0, 'Importo non può essere zero'),
  startDate: isoDate,
  endDate: isoDate.nullable().optional(),
})

export const budgetLimitChangeParamsSchema = z.object({
  categoryId: z.string().uuid(),
  newLimit: positiveAmount,
})

export const goalContributionChangeParamsSchema = z.object({
  goalId: z.string().uuid(),
  newMonthlyAmount: nonNegativeAmount,
  startDate: isoDate,
  endDate: isoDate.nullable().optional(),
})

export const goalDeadlineChangeParamsSchema = z.object({
  goalId: z.string().uuid(),
  newDeadline: isoDate,
})

export const goalOneTimeContributionParamsSchema = z.object({
  goalId: z.string().uuid(),
  amount: positiveAmount,
  date: isoDate,
})

export const loanEarlyPayoffParamsSchema = z.object({
  loanId: z.string().uuid(),
  payoffDate: isoDate,
  penaltyAmount: nonNegativeAmount.nullable().optional(),
})

export const newLoanParamsSchema = z.object({
  description: z.string().min(1).max(200),
  principalAmount: positiveAmount,
  downPayment: nonNegativeAmount.nullable().optional(),
  monthlyPayment: positiveAmount,
  numberOfPayments: z.number().int().min(1).max(600),
  firstPaymentDate: isoDate,
}).refine(
  (d) => !d.downPayment || d.downPayment <= d.principalAmount,
  { message: 'Anticipo non può superare il capitale', path: ['downPayment'] },
)

export const accountBalanceAdjustmentParamsSchema = z.object({
  adjustmentAmount: z.number().finite().refine((v) => v !== 0, 'Importo non può essere zero'),
})

// ── Params schema map ─────────────────────────────────────────────────────────

export const ACTION_PARAM_SCHEMAS = {
  ONE_TIME_EXPENSE: oneTimeExpenseParamsSchema,
  RECURRING_EXPENSE_ADD: recurringExpenseAddParamsSchema,
  RECURRING_EXPENSE_UPDATE: recurringExpenseUpdateParamsSchema,
  RECURRING_EXPENSE_REMOVE: recurringExpenseRemoveParamsSchema,
  RECURRING_INCOME_ADD: recurringIncomeAddParamsSchema,
  RECURRING_INCOME_REDUCE: recurringIncomeReduceParamsSchema,
  RECURRING_INCOME_PAUSE: recurringIncomePauseParamsSchema,
  MONTHLY_SAVINGS_CHANGE: monthlySavingsChangeParamsSchema,
  CATEGORY_SPENDING_CHANGE: categorySpendingChangeParamsSchema,
  BUDGET_LIMIT_CHANGE: budgetLimitChangeParamsSchema,
  GOAL_CONTRIBUTION_CHANGE: goalContributionChangeParamsSchema,
  GOAL_DEADLINE_CHANGE: goalDeadlineChangeParamsSchema,
  GOAL_ONE_TIME_CONTRIBUTION: goalOneTimeContributionParamsSchema,
  LOAN_EARLY_PAYOFF: loanEarlyPayoffParamsSchema,
  NEW_LOAN: newLoanParamsSchema,
  ACCOUNT_BALANCE_ADJUSTMENT: accountBalanceAdjustmentParamsSchema,
} as const

// ── Scenario action schema ────────────────────────────────────────────────────

export const scenarioActionSchema = z.object({
  id: z.string().min(1),
  code: z.enum([...ACTION_CODES] as unknown as [string, ...string[]]),
  enabled: z.boolean(),
  label: z.string().max(MAX_ACTION_LABEL_LENGTH).nullable().optional(),
  params: z.record(z.string(), z.unknown()),
})

// ── Assumptions schema ────────────────────────────────────────────────────────

export const scenarioAssumptionsSchema = z.object({
  includeActiveRecurring: z.boolean(),
  includeGoalContributions: z.boolean(),
  goalContributionSource: z.enum(['recent_average', 'none']),
  loanPaymentSource: z.enum(['recent_average', 'none']),
  excludedAccountIds: z.array(z.string().uuid()).max(50),
})

// ── Create/update scenario schemas ────────────────────────────────────────────

export const createScenarioSchema = z.object({
  name: z.string().min(1).max(MAX_SCENARIO_NAME_LENGTH),
  description: z.string().max(MAX_SCENARIO_DESCRIPTION_LENGTH).nullable().optional(),
  horizon_months: z.number().int().min(1).max(MAX_HORIZON_MONTHS).default(12),
  start_date: isoDate,
  currency: z.string().length(3).nullable().optional(),
  actions: z.array(scenarioActionSchema).max(MAX_ACTIONS_PER_SCENARIO).default([]),
  assumptions: scenarioAssumptionsSchema.optional(),
  is_favorite: z.boolean().default(false),
})

export const updateScenarioSchema = createScenarioSchema.partial().omit({ start_date: true }).extend({
  start_date: isoDate.optional(),
  status: z.enum([...SCENARIO_STATUSES] as unknown as [string, ...string[]]).optional(),
})

// ── Calculate-without-save schema ─────────────────────────────────────────────

export const calculateScenarioSchema = z.object({
  horizon_months: z.number().int().min(1).max(MAX_HORIZON_MONTHS).default(12),
  start_date: isoDate,
  currency: z.string().length(3).nullable().optional(),
  actions: z.array(scenarioActionSchema).max(MAX_ACTIONS_PER_SCENARIO),
  assumptions: scenarioAssumptionsSchema.optional(),
})

// ── List query schema ─────────────────────────────────────────────────────────

export const scenarioListQuerySchema = z.object({
  status: z.enum([...SCENARIO_STATUSES] as unknown as [string, ...string[]]).optional(),
  is_favorite: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
