import type {
  ActionModifications,
  ProjectionPeriod,
  RecurringIncomeAddParams,
  RecurringIncomeReduceParams,
  RecurringIncomePauseParams,
} from '../types'
import type { RecurringRule } from '@/types/database'
import { countOccurrencesInPeriod, parseDateUTC } from '../dates'
import { roundMoney } from '../money'

// ── ADD: new simulated recurring income ───────────────────────────────────────

export function applyRecurringIncomeAdd(
  params: RecurringIncomeAddParams,
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
      incomeAdjustment: amount,
      expenseAdjustment: 0,
      loanAdjustment: 0,
      goalAdjustment: 0,
      notes: [`Nuova entrata: ${params.description} (${n}× €${params.amount})`],
    })
  }

  return mods
}

// ── REDUCE: reduce income by a fixed monthly amount ───────────────────────────

export function applyRecurringIncomeReduce(
  params: RecurringIncomeReduceParams,
  periods: ProjectionPeriod[],
  existingRules: RecurringRule[],
): ActionModifications {
  const mods: ActionModifications = new Map()

  // If tied to a specific rule, validate it's an income rule
  if (params.ruleId) {
    const rule = existingRules.find((r) => r.id === params.ruleId && r.type === 'income')
    if (!rule) return mods
  }

  for (const period of periods) {
    if (period.startDate < params.startDate) continue
    if (params.endDate && period.endDate > params.endDate) continue

    mods.set(period.key, {
      incomeAdjustment: -roundMoney(params.reductionAmount),
      expenseAdjustment: 0,
      loanAdjustment: 0,
      goalAdjustment: 0,
      notes: [`Riduzione entrata: −€${params.reductionAmount}/mese`],
    })
  }

  return mods
}

// ── PAUSE: temporarily pause income from a rule ───────────────────────────────

export function applyRecurringIncomePause(
  params: RecurringIncomePauseParams,
  periods: ProjectionPeriod[],
  existingRules: RecurringRule[],
): ActionModifications {
  const mods: ActionModifications = new Map()

  // Determine which rule(s) to pause
  const rulesToPause = params.ruleId
    ? existingRules.filter((r) => r.id === params.ruleId && r.type === 'income')
    : existingRules.filter((r) => r.is_active && r.type === 'income')

  if (rulesToPause.length === 0) return mods

  for (const period of periods) {
    // Only apply during the pause window
    if (period.endDate < params.startDate) continue
    if (period.startDate > params.endDate) continue

    let totalReduction = 0
    const notes: string[] = []

    for (const rule of rulesToPause) {
      const periodStart = parseDateUTC(period.startDate)
      const periodEnd = parseDateUTC(period.endDate)
      const n = countOccurrencesInPeriod(rule, periodStart, periodEnd)
      if (n === 0) continue
      const reduction = roundMoney(rule.amount * n)
      totalReduction = roundMoney(totalReduction + reduction)
      notes.push(`Pausa: ${rule.description} (${n}× €${rule.amount})`)
    }

    if (totalReduction > 0) {
      mods.set(period.key, {
        incomeAdjustment: -totalReduction,
        expenseAdjustment: 0,
        loanAdjustment: 0,
        goalAdjustment: 0,
        notes,
      })
    }
  }

  return mods
}
