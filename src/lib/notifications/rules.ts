import type { Account, Loan, LoanPayment, RecurringRule, SavingsGoal, Transaction, AutomationRuleApplication } from '@/types/database'
import type { BudgetEntry } from '@/lib/budgets/service'
import type { NotificationCandidate, NotificationSeverity } from './types'
import {
  BUDGET_CRITICAL_THRESHOLD,
  BUDGET_WARNING_THRESHOLD,
  DUPLICATE_WINDOW_DAYS,
  GOAL_BEHIND_TOLERANCE_PCT,
  GOAL_CRITICAL_DAYS_LIMIT,
  GOAL_CRITICAL_GAP_PCT,
  LOAN_DUE_DAYS_WARNING,
  NEGATIVE_BALANCE_CRITICAL_THRESHOLD,
  PROJECTED_BALANCE_DAYS,
  UPCOMING_DAYS_WARNING,
} from './constants'
import type {
  AutomationNotificationConfig,
  BalanceNotificationConfig,
  BudgetNotificationConfig,
  DuplicateNotificationConfig,
  GoalNotificationConfig,
  LoanNotificationConfig,
  RecurrenceNotificationConfig,
} from './preferences-types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function eur(amount: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount)
}

/** Days between two dates (positive = future is after base) */
function daysBetween(base: Date, target: Date): number {
  const ms = target.getTime() - base.getTime()
  return Math.floor(ms / 86_400_000)
}

/** Parse YYYY-MM-DD date string as a UTC midnight Date */
function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`)
}

/** Period key for the current month: "2026-07" */
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** How many times a recurring rule fires on or after `from` and before `to` (inclusive both) */
function countOccurrences(rule: RecurringRule, from: Date, to: Date): { date: Date; amount: number }[] {
  const occurrences: { date: Date; amount: number }[] = []
  const start = parseDate(rule.next_due_date)
  const end   = rule.end_date ? parseDate(rule.end_date) : to

  let cur = new Date(start)
  while (cur <= to && cur <= end) {
    if (cur >= from) {
      occurrences.push({ date: new Date(cur), amount: Number(rule.amount) })
    }
    // Advance by frequency
    switch (rule.frequency) {
      case 'daily':      cur = new Date(cur.getTime() + 86_400_000); break
      case 'weekly':     cur = new Date(cur.getTime() + 7 * 86_400_000); break
      case 'biweekly':   cur = new Date(cur.getTime() + 14 * 86_400_000); break
      case 'monthly':    cur = new Date(cur.setUTCMonth(cur.getUTCMonth() + 1)); break
      case 'quarterly':  cur = new Date(cur.setUTCMonth(cur.getUTCMonth() + 3)); break
      case 'yearly':     cur = new Date(cur.setUTCFullYear(cur.getUTCFullYear() + 1)); break
      default:           cur = new Date(cur.getTime() + 86_400_000)
    }
  }
  return occurrences
}

function normalizeDescription(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
}

// ── 1. Projected balance rules ───────────────────────────────────────────────

export function evaluateBalanceRules(
  accounts: Account[],
  recurringRules: RecurringRule[],
  now: Date,
  config?: Partial<BalanceNotificationConfig>,
): NotificationCandidate[] {
  const candidates: NotificationCandidate[] = []
  const lookahead     = config?.lookaheadDays ?? PROJECTED_BALANCE_DAYS
  const criticalBelow = config?.criticalBelow ?? NEGATIVE_BALANCE_CRITICAL_THRESHOLD
  const accountIds    = config?.accountIds ?? null

  const today    = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const horizon  = new Date(today.getTime() + lookahead * 86_400_000)

  for (const account of accounts) {
    if (!account.is_active) continue
    if (accountIds && !accountIds.includes(account.id)) continue

    const accountRules = recurringRules.filter(
      (r) => r.is_active && r.account_id === account.id,
    )

    // Build daily balance projection
    let balance       = Number(account.balance)
    let firstNegDate: Date | null = null
    let lowestBalance = balance

    for (let d = 0; d < lookahead; d++) {
      const day = new Date(today.getTime() + d * 86_400_000)
      for (const rule of accountRules) {
        const due = parseDate(rule.next_due_date)
        if (due.getTime() !== day.getTime()) continue
        if (rule.end_date && day > parseDate(rule.end_date)) continue
        if (rule.type === 'income')   balance += Number(rule.amount)
        if (rule.type === 'expense')  balance -= Number(rule.amount)
      }
      // Also count future occurrences of existing rules on this day
      for (const rule of accountRules) {
        const occs = countOccurrences(rule, day, day)
        for (const o of occs) {
          if (o.date.getTime() === day.getTime()) {
            // Already counted next_due_date above — skip if same date
            const due = parseDate(rule.next_due_date)
            if (due.getTime() === day.getTime()) continue
            if (rule.type === 'income')  balance += o.amount
            if (rule.type === 'expense') balance -= o.amount
          }
        }
      }
      if (balance < lowestBalance) lowestBalance = balance
      if (balance < 0 && firstNegDate === null) {
        firstNegDate = new Date(day)
      }
    }

    if (firstNegDate === null) continue // stays positive

    const negDateStr = firstNegDate.toISOString().slice(0, 10)
    const severity: NotificationSeverity =
      lowestBalance < criticalBelow ? 'CRITICAL' : 'WARNING'

    const displayDate = firstNegDate.toLocaleDateString('it-IT', {
      day: 'numeric', month: 'long', timeZone: 'UTC',
    })

    candidates.push({
      dedupeKey:  `negative_projected_balance:${account.id}:${negDateStr}`,
      type:       'negative_projected_balance',
      severity,
      title:      `Saldo previsto negativo — ${account.name}`,
      message:    `Il conto ${account.name} potrebbe raggiungere ${eur(lowestBalance)} il ${displayDate}.`,
      sourceType: 'account',
      sourceId:   account.id,
      sourceUrl:  `/calendar?view=agenda&range=${PROJECTED_BALANCE_DAYS}&account=${account.id}`,
      metadata:   {
        accountName:    account.name,
        currentBalance: Number(account.balance),
        projectedMin:   lowestBalance,
        firstNegDate:   negDateStr,
      },
      isCondition: true,
    })
  }

  return candidates
}

// ── 2. Budget rules ──────────────────────────────────────────────────────────

export function evaluateBudgetRules(
  budgets: BudgetEntry[],
  now: Date,
  config?: Partial<BudgetNotificationConfig>,
): NotificationCandidate[] {
  const candidates: NotificationCandidate[] = []
  const warningPct  = config?.warningPercentage  ?? BUDGET_WARNING_THRESHOLD
  const criticalPct = config?.criticalPercentage ?? BUDGET_CRITICAL_THRESHOLD
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  for (const b of budgets) {
    const pct = b.percentage

    if (pct >= criticalPct) {
      const overrun = b.spent - b.amount
      candidates.push({
        dedupeKey:  `budget_threshold:${b.budgetId}:${period}:${criticalPct}`,
        type:       'budget_threshold',
        severity:   'CRITICAL',
        title:      `Budget superato — ${b.categoryName}`,
        message:    `Il budget ${b.categoryName} è stato superato di ${eur(overrun)} (${Math.round(pct)}% utilizzato, limite ${eur(b.amount)}).`,
        sourceType: 'budget',
        sourceId:   b.budgetId,
        sourceUrl:  `/budgets/${b.budgetId}`,
        metadata:   { categoryName: b.categoryName, amount: b.amount, spent: b.spent, percentage: pct, period },
        isCondition: true,
      })
    }

    if (pct >= warningPct && pct < criticalPct) {
      candidates.push({
        dedupeKey:  `budget_threshold:${b.budgetId}:${period}:${warningPct}`,
        type:       'budget_threshold',
        severity:   'WARNING',
        title:      `Budget quasi esaurito — ${b.categoryName}`,
        message:    `Il budget ${b.categoryName} ha raggiunto il ${Math.round(pct)}% (${eur(b.spent)} di ${eur(b.amount)}).`,
        sourceType: 'budget',
        sourceId:   b.budgetId,
        sourceUrl:  `/budgets/${b.budgetId}`,
        metadata:   { categoryName: b.categoryName, amount: b.amount, spent: b.spent, percentage: pct, period },
        isCondition: true,
      })
    }
  }

  return candidates
}

// ── 3. Recurring rules ────────────────────────────────────────────────────────

export function evaluateRecurrenceRules(
  rules: RecurringRule[],
  now: Date,
  config?: Partial<RecurrenceNotificationConfig>,
): NotificationCandidate[] {
  const candidates: NotificationCandidate[] = []
  const advanceDays      = config?.advanceDays ?? UPCOMING_DAYS_WARNING
  const overdueEnabled   = config?.overdueEnabled ?? true
  const overdueCritical  = config?.overdueCriticalAfterDays ?? 7
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  for (const rule of rules) {
    if (!rule.is_active) continue
    const due      = parseDate(rule.next_due_date)
    const daysLeft = daysBetween(today, due)

    // Upcoming: 1 to advanceDays days before
    if (daysLeft > 0 && daysLeft <= advanceDays) {
      const severity: NotificationSeverity = daysLeft === 1 ? 'WARNING' : 'INFO'
      const dayLabel = daysLeft === 1 ? 'domani' : `tra ${daysLeft} giorni`
      candidates.push({
        dedupeKey:   `upcoming_recurrence:${rule.id}:${rule.next_due_date}`,
        type:        'upcoming_recurrence',
        severity,
        title:       `Ricorrenza imminente — ${rule.description}`,
        message:     `${rule.description} (${eur(Number(rule.amount))}) è prevista ${dayLabel}.`,
        sourceType:  'recurring_rule',
        sourceId:    rule.id,
        sourceUrl:   `/recurring`,
        metadata:    { description: rule.description, amount: Number(rule.amount), dueDate: rule.next_due_date, daysLeft },
        isCondition: true,
      })
    }

    // Due today
    if (daysLeft === 0) {
      candidates.push({
        dedupeKey:   `upcoming_recurrence:${rule.id}:${rule.next_due_date}`,
        type:        'upcoming_recurrence',
        severity:    'WARNING',
        title:       `Ricorrenza in scadenza oggi — ${rule.description}`,
        message:     `${rule.description} (${eur(Number(rule.amount))}) è prevista per oggi.`,
        sourceType:  'recurring_rule',
        sourceId:    rule.id,
        sourceUrl:   `/recurring`,
        metadata:    { description: rule.description, amount: Number(rule.amount), dueDate: rule.next_due_date, daysLeft: 0 },
        isCondition: true,
      })
    }

    // Overdue: next_due_date is in the past (only for manual rules — auto_create handles them)
    if (daysLeft < 0 && !rule.auto_create && overdueEnabled) {
      const overdueDays = Math.abs(daysLeft)
      const severity: NotificationSeverity = overdueDays >= overdueCritical ? 'CRITICAL' : 'WARNING'
      candidates.push({
        dedupeKey:   `overdue_recurrence:${rule.id}:${rule.next_due_date}`,
        type:        'overdue_recurrence',
        severity,
        title:       `Ricorrenza scaduta — ${rule.description}`,
        message:     `${rule.description} (${eur(Number(rule.amount))}) era prevista il ${due.toLocaleDateString('it-IT', { timeZone: 'UTC' })} e non è stata registrata (${overdueDays} ${overdueDays === 1 ? 'giorno' : 'giorni'} fa).`,
        sourceType:  'recurring_rule',
        sourceId:    rule.id,
        sourceUrl:   `/recurring`,
        metadata:    { description: rule.description, amount: Number(rule.amount), dueDate: rule.next_due_date, overdueDays },
        isCondition: true,
      })
    }
  }

  return candidates
}

// ── 4. Goal rules ─────────────────────────────────────────────────────────────

export function evaluateGoalRules(
  goals: SavingsGoal[],
  now: Date,
  config?: Partial<GoalNotificationConfig>,
): NotificationCandidate[] {
  const candidates: NotificationCandidate[] = []
  const tolerance     = config?.tolerancePercentagePoints  ?? GOAL_BEHIND_TOLERANCE_PCT
  const criticalDays  = config?.criticalDaysRemaining       ?? GOAL_CRITICAL_DAYS_LIMIT
  const criticalGap   = config?.criticalGapPercentagePoints ?? GOAL_CRITICAL_GAP_PCT
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const period = monthKey(now)

  for (const goal of goals) {
    if (goal.status !== 'ACTIVE' || goal.archived) continue
    if (!goal.target_date) continue

    const targetDate = parseDate(goal.target_date)
    if (targetDate <= today) continue  // already overdue, handled elsewhere or completed

    const startDate   = parseDate(goal.created_at.slice(0, 10))
    const totalDays   = Math.max(1, daysBetween(startDate, targetDate))
    const elapsedDays = Math.max(0, daysBetween(startDate, today))
    const timeProgress  = elapsedDays / totalDays  // 0..1
    const amountProgress = Number(goal.current_amount) / Number(goal.target_amount)  // 0..1

    const gap = (timeProgress - amountProgress) * 100  // pp behind schedule
    if (gap <= tolerance) continue  // within tolerance

    const daysLeft          = daysBetween(today, targetDate)
    const expectedPct       = Math.round(timeProgress * 100)
    const actualPct         = Math.round(amountProgress * 100)
    const isCritical        = daysLeft <= criticalDays && gap >= criticalGap
    const severity: NotificationSeverity = isCritical ? 'CRITICAL' : 'WARNING'

    candidates.push({
      dedupeKey:   `goal_behind_schedule:${goal.id}:${period}`,
      type:        'goal_behind_schedule',
      severity,
      title:       `Obiettivo in ritardo — ${goal.name}`,
      message:     `L'obiettivo "${goal.name}" è al ${actualPct}%, mentre per rispettare la scadenza dovrebbe essere circa al ${expectedPct}%.`,
      sourceType:  'savings_goal',
      sourceId:    goal.id,
      sourceUrl:   `/goals/${goal.id}`,
      metadata:    {
        goalName: goal.name, currentAmount: Number(goal.current_amount),
        targetAmount: Number(goal.target_amount), targetDate: goal.target_date,
        actualPct, expectedPct, daysLeft, gap: Math.round(gap),
      },
      isCondition: true,
    })
  }

  return candidates
}

// ── 5. Loan rules ─────────────────────────────────────────────────────────────

export function evaluateLoanRules(
  loans: Loan[],
  loanPayments: LoanPayment[],
  now: Date,
  config?: Partial<LoanNotificationConfig>,
): NotificationCandidate[] {
  const candidates: NotificationCandidate[] = []
  const advanceDays    = config?.advanceDays    ?? LOAN_DUE_DAYS_WARNING
  const overdueEnabled = config?.overdueEnabled ?? true
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  // Index payments by loan_id for quick lookup
  const paymentsByLoan = new Map<string, LoanPayment[]>()
  for (const p of loanPayments) {
    const list = paymentsByLoan.get(p.loan_id) ?? []
    list.push(p)
    paymentsByLoan.set(p.loan_id, list)
  }

  for (const loan of loans) {
    if (loan.is_settled) continue
    if (!loan.due_date) continue

    const due      = parseDate(loan.due_date)
    const daysLeft = daysBetween(today, due)

    if (daysLeft < 0 && overdueEnabled) {
      // Overdue
      candidates.push({
        dedupeKey:   `overdue_loan_payment:${loan.id}:${loan.due_date}`,
        type:        'overdue_loan_payment',
        severity:    'CRITICAL',
        title:       `Prestito scaduto — ${loan.counterpart}`,
        message:     `Il prestito con ${loan.counterpart} (${eur(Number(loan.remaining))} residui) era in scadenza il ${due.toLocaleDateString('it-IT', { timeZone: 'UTC' })}.`,
        sourceType:  'loan',
        sourceId:    loan.id,
        sourceUrl:   `/loans`,
        metadata:    { counterpart: loan.counterpart, remaining: Number(loan.remaining), dueDate: loan.due_date, daysLeft },
        isCondition: true,
      })
    } else if (daysLeft === 0) {
      candidates.push({
        dedupeKey:   `upcoming_loan_payment:${loan.id}:${loan.due_date}`,
        type:        'upcoming_loan_payment',
        severity:    'WARNING',
        title:       `Prestito in scadenza oggi — ${loan.counterpart}`,
        message:     `Il prestito con ${loan.counterpart} (${eur(Number(loan.remaining))} residui) scade oggi.`,
        sourceType:  'loan',
        sourceId:    loan.id,
        sourceUrl:   `/loans`,
        metadata:    { counterpart: loan.counterpart, remaining: Number(loan.remaining), dueDate: loan.due_date, daysLeft: 0 },
        isCondition: true,
      })
    } else if (daysLeft <= advanceDays) {
      const severity: NotificationSeverity = daysLeft <= UPCOMING_DAYS_WARNING ? 'WARNING' : 'INFO'
      candidates.push({
        dedupeKey:   `loan_due_soon:${loan.id}:${loan.due_date}`,
        type:        'loan_due_soon',
        severity,
        title:       `Prestito in scadenza — ${loan.counterpart}`,
        message:     `Il prestito con ${loan.counterpart} (${eur(Number(loan.remaining))} residui) scade tra ${daysLeft} ${daysLeft === 1 ? 'giorno' : 'giorni'}.`,
        sourceType:  'loan',
        sourceId:    loan.id,
        sourceUrl:   `/loans`,
        metadata:    { counterpart: loan.counterpart, remaining: Number(loan.remaining), dueDate: loan.due_date, daysLeft },
        isCondition: true,
      })
    }
  }

  return candidates
}

// ── 6. Automation rules ───────────────────────────────────────────────────────

export function evaluateAutomationRules(
  applications: Pick<AutomationRuleApplication,
    'id' | 'rule_id' | 'transaction_id' | 'application_batch_id' |
    'result' | 'error_code' | 'applied_at' | 'applied_values'>[],
  config?: Partial<AutomationNotificationConfig>,
): NotificationCandidate[] {
  const candidates: NotificationCandidate[] = []
  const includeConflicts = config?.includeConflicts ?? true

  for (const app of applications) {
    if (app.result === 'FAILED') {
      candidates.push({
        dedupeKey:   `automation_failure:${app.id}`,
        type:        'automation_failure',
        severity:    'CRITICAL',
        title:       'Automazione fallita',
        message:     `Un'applicazione di regola automatica è fallita${app.error_code ? ` (codice: ${app.error_code})` : ''}.`,
        sourceType:  'automation',
        sourceId:    app.rule_id ?? null,
        sourceUrl:   '/automation?tab=history',
        metadata:    { applicationId: app.id, ruleId: app.rule_id, transactionId: app.transaction_id, errorCode: app.error_code },
        isCondition: false,
      })
    } else if (app.result === 'CONFLICT' && includeConflicts) {
      candidates.push({
        dedupeKey:   `automation_conflict:${app.id}`,
        type:        'automation_conflict',
        severity:    'WARNING',
        title:       'Conflitto automazione',
        message:     `L'applicazione di una regola ha rilevato un conflitto con valori esistenti.`,
        sourceType:  'automation',
        sourceId:    app.rule_id ?? null,
        sourceUrl:   '/automation?tab=history',
        metadata:    { applicationId: app.id, ruleId: app.rule_id, transactionId: app.transaction_id },
        isCondition: false,
      })
    }
  }

  return candidates
}

// ── 7. Duplicate detection ────────────────────────────────────────────────────

export function evaluateDuplicateRules(
  transactions: Pick<Transaction, 'id' | 'account_id' | 'type' | 'amount' | 'description' | 'date' | 'transfer_peer_id'>[],
  now: Date,
  config?: Partial<DuplicateNotificationConfig>,
): NotificationCandidate[] {
  const candidates: NotificationCandidate[] = []
  const windowDays  = DUPLICATE_WINDOW_DAYS + (config?.dateToleranceDays ?? 0)
  const requireDesc = config?.descriptionMatchRequired ?? false
  const today    = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const cutoff   = new Date(today.getTime() - windowDays * 86_400_000)

  // Exclude transfers entirely
  const eligible = transactions.filter(
    (t) => t.transfer_peer_id === null && t.type !== 'transfer' && parseDate(t.date) >= cutoff,
  )

  // Group by fingerprint: account + type + amount + date + (optionally) normalized description
  const groups = new Map<string, typeof eligible>()
  for (const tx of eligible) {
    const descPart = requireDesc ? normalizeDescription(tx.description) : ''
    const key = [
      tx.account_id,
      tx.type,
      String(Number(tx.amount).toFixed(2)),
      tx.date,
      descPart,
    ].join('|')
    const g = groups.get(key) ?? []
    g.push(tx)
    groups.set(key, g)
  }

  for (const [, group] of groups) {
    if (group.length < 2) continue
    // Generate candidates for each pair (stable order)
    for (let i = 0; i < group.length - 1; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]
        const b = group[j]
        const [lo, hi] = a.id < b.id ? [a.id, b.id] : [b.id, a.id]
        candidates.push({
          dedupeKey:   `possible_duplicate:${lo}:${hi}`,
          type:        'possible_duplicate',
          severity:    'WARNING',
          title:       'Possibile movimento duplicato',
          message:     `Due movimenti da ${eur(Number(a.amount))} risultano identici per data, importo e descrizione.`,
          sourceType:  'transaction',
          sourceId:    lo,
          sourceUrl:   `/transactions?search=${encodeURIComponent(a.description ?? '')}&date=${a.date}`,
          metadata:    { transactionId1: lo, transactionId2: hi, amount: Number(a.amount), date: a.date, description: a.description },
          isCondition: false,
        })
      }
    }
  }

  return candidates
}
