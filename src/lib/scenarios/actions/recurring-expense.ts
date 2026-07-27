import type {
  ActionModifications,
  ProjectionPeriod,
  RecurringExpenseAddParams,
  RecurringExpenseUpdateParams,
  RecurringExpenseRemoveParams,
} from '../types'
import type { RecurringRule } from '@/types/database'
import { countOccurrencesInPeriod, parseDateUTC } from '../dates'
import { roundMoney } from '../money'

// ── ADD: new simulated recurring expense ──────────────────────────────────────

export function applyRecurringExpenseAdd(
  params: RecurringExpenseAddParams,
  periods: ProjectionPeriod[],
): ActionModifications {
  const mods: ActionModifications = new Map()
  const rule = {
    is_active: true,
    start_date: params.startDate,
    end_date: params.endDate ?? null,
    next_due_date: params.startDate,
    frequency: params.frequency,
    amount: params.amount,
  }

  for (const period of periods) {
    const n = countOccurrencesInPeriod(rule, parseDateUTC(period.startDate), parseDateUTC(period.endDate))
    if (n === 0) continue
    const amount = roundMoney(params.amount * n)
    mods.set(period.key, {
      incomeAdjustment: 0,
      expenseAdjustment: amount,
      loanAdjustment: 0,
      goalAdjustment: 0,
      notes: [`Nuova spesa: ${params.description} (${n}× €${params.amount})`],
    })
  }

  return mods
}

// ── UPDATE: change amount of an existing recurring rule ───────────────────────

export function applyRecurringExpenseUpdate(
  params: RecurringExpenseUpdateParams,
  periods: ProjectionPeriod[],
  existingRules: RecurringRule[],
): ActionModifications {
  const mods: ActionModifications = new Map()
  const rule = existingRules.find((r) => r.id === params.ruleId)
  if (!rule || rule.type !== 'expense') return mods

  for (const period of periods) {
    if (period.startDate < params.startDate) continue
    if (params.endDate && period.endDate > params.endDate) continue

    const periodStart = parseDateUTC(period.startDate)
    const periodEnd = parseDateUTC(period.endDate)
    const n = countOccurrencesInPeriod(rule, periodStart, periodEnd)
    if (n === 0) continue

    // Delta = new amount - original amount per occurrence
    const delta = roundMoney((params.newAmount - rule.amount) * n)
    mods.set(period.key, {
      incomeAdjustment: 0,
      expenseAdjustment: delta,   // positive = more expense, negative = less
      loanAdjustment: 0,
      goalAdjustment: 0,
      notes: [`Spesa modificata: ${rule.description} → €${params.newAmount}/occ.`],
    })
  }

  return mods
}

// ── REMOVE: simulate removing an existing recurring expense ───────────────────

export function applyRecurringExpenseRemove(
  params: RecurringExpenseRemoveParams,
  periods: ProjectionPeriod[],
  existingRules: RecurringRule[],
): ActionModifications {
  const mods: ActionModifications = new Map()
  const rule = existingRules.find((r) => r.id === params.ruleId)
  if (!rule || rule.type !== 'expense') return mods

  for (const period of periods) {
    if (period.startDate < params.startDate) continue

    const periodStart = parseDateUTC(period.startDate)
    const periodEnd = parseDateUTC(period.endDate)
    const n = countOccurrencesInPeriod(rule, periodStart, periodEnd)
    if (n === 0) continue

    const saved = roundMoney(rule.amount * n)
    mods.set(period.key, {
      incomeAdjustment: 0,
      expenseAdjustment: -saved,  // negative = less expense
      loanAdjustment: 0,
      goalAdjustment: 0,
      notes: [`Spesa rimossa: ${rule.description} (${n}× €${rule.amount})`],
    })
  }

  return mods
}
