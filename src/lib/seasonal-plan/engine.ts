import type { FinancialCalendarEvent } from '@/lib/financial-calendar/types'
import { installmentDate } from '@/lib/installments/schedule'
import { monthKeys, type SeasonalPlan } from './schema'
export type PlanEvent = {
  id: string
  date: string
  title: string
  direction: 'INCOME' | 'EXPENSE'
  amount: number
  confidence: 'CONFIRMED' | 'ESTIMATED'
  source: 'RECURRING' | 'INSTALLMENT' | 'MANUAL' | 'LIVING'
}
const cents = (n: number) => Math.round(n * 100)
export function calculateSeasonalPlan(params: {
  plan: SeasonalPlan
  today: string
  openingBalance: number
  automatic: FinancialCalendarEvent[]
  unavailableAccounts?: boolean
}) {
  const { plan, today } = params
  const months = monthKeys(today)
  const [year, month] = months[11].split('-').map(Number)
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
  const events: PlanEvent[] = params.automatic
    .filter(
      (e) =>
        e.date >= today &&
        e.date <= end &&
        e.direction === 'EXPENSE' &&
        e.status !== 'COMPLETED' &&
        e.amount !== null,
    )
    .map((e) => ({
      id: e.id,
      date: e.date,
      title: e.title,
      direction: 'EXPENSE',
      amount: e.amount!,
      confidence: 'ESTIMATED',
      source: e.sourceType === 'INSTALLMENT' ? 'INSTALLMENT' : 'RECURRING',
    }))
  // Monthly income replaces recurring income. Already received amounts are in today's balance.
  for (const row of plan.months.filter((m) => months.includes(m.month))) {
    const incomes = [
      {
        ...row,
        title:
          row.kind === 'SALARY'
            ? 'Stipendio'
            : row.kind === 'NASPI'
              ? 'NASpI'
              : 'Altre entrate',
      },
      { ...row.extra, title: row.extra.label },
    ]
    for (const [index, income] of incomes.entries()) {
      if (income.received || income.amount <= 0) continue
      const [y, m] = row.month.split('-').map(Number)
      const date = `${row.month}-${String(Math.min(income.day, new Date(Date.UTC(y, m, 0)).getUTCDate())).padStart(2, '0')}`
      events.push({
        id: `income:${row.month}:${index}`,
        date: date < today ? today : date,
        title: income.title,
        direction: 'INCOME',
        amount: income.amount,
        confidence: income.confidence,
        source: 'MANUAL',
      })
    }
  }
  for (const c of plan.commitments) {
    const schedule = {
      amount: c.amount,
      frequency: 'monthly' as const,
      interval: 1,
      first_due_date: c.start_date,
      first_installment_number: 1,
      paused: false,
    }
    for (let n = 1; n <= 1200; n++) {
      const date = installmentDate(schedule, n)
      if (date > end || date > c.end_date) break
      if (date < today) continue
      events.push({
        id: `manual:${c.id}:${date}`,
        date,
        title: c.title,
        direction: 'EXPENSE',
        amount: c.amount,
        confidence: c.confidence,
        source: 'MANUAL',
      })
    }
  }
  // Spread everyday extra costs across days: the current month includes only remaining days.
  for (const key of months) {
    const [y, m] = key.split('-').map(Number)
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const monthly = cents(plan.monthly_extra_expenses)
    for (let d = 1; d <= days; d++) {
      const date = `${key}-${String(d).padStart(2, '0')}`
      if (date < today) continue
      const daily = Math.floor(monthly / days) + (d <= monthly % days ? 1 : 0)
      if (daily)
        events.push({
          id: `living:${date}`,
          date,
          title: 'Spese quotidiane extra',
          direction: 'EXPENSE',
          amount: daily / 100,
          confidence: 'ESTIMATED',
          source: 'LIVING',
        })
    }
  }
  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.direction === b.direction
        ? a.id.localeCompare(b.id)
        : a.direction === 'EXPENSE'
          ? -1
          : 1),
  )
  const opening = cents(params.openingBalance),
    reserve = cents(plan.reserve)
  let conservative = opening,
    expected = opening,
    minConservative = opening,
    minExpected = opening
  let minDate = today
  const rows = months.map((key) => {
    const openingExpected = expected,
      openingConservative = conservative
    let confirmedIncome = 0,
      estimatedIncome = 0,
      confirmedExpenses = 0,
      estimatedExpenses = 0
    const monthEvents = events.filter((e) => e.date.startsWith(key))
    for (const event of monthEvents) {
      const value = cents(event.amount)
      if (event.direction === 'EXPENSE') {
        conservative -= value
        expected -= value
        if (event.confidence === 'CONFIRMED') confirmedExpenses += value
        else estimatedExpenses += value
      } else {
        expected += value
        if (event.confidence === 'CONFIRMED') {
          conservative += value
          confirmedIncome += value
        } else estimatedIncome += value
      }
      if (conservative < minConservative) {
        minConservative = conservative
        minDate = event.date
      }
      minExpected = Math.min(minExpected, expected)
    }
    return {
      month: key,
      opening: openingExpected / 100,
      openingConservative: openingConservative / 100,
      confirmedIncome: confirmedIncome / 100,
      estimatedIncome: estimatedIncome / 100,
      confirmedExpenses: confirmedExpenses / 100,
      estimatedExpenses: estimatedExpenses / 100,
      closing: expected / 100,
      closingConservative: conservative / 100,
      belowReserve: conservative < reserve,
    }
  })
  const coverage = months.every((key) =>
    plan.months.some((m) => m.month === key),
  )
  const complete =
    plan.reviewed &&
    coverage &&
    !params.unavailableAccounts &&
    plan.account_ids.length > 0
  const available = (minimum: number) =>
    Math.max(0, Math.min(opening - reserve, minimum - reserve)) / 100
  return {
    from: today,
    to: end,
    complete,
    coverage,
    openingBalance: opening / 100,
    reserve: reserve / 100,
    spendableConfirmed: complete ? available(minConservative) : null,
    spendableEstimated: complete ? available(minExpected) : null,
    shortfall: Math.max(0, reserve - minConservative) / 100,
    minimumConfirmed: minConservative / 100,
    minimumEstimated: minExpected / 100,
    minimumDate: minDate,
    rows,
    events,
  }
}
export type SeasonalForecast = ReturnType<typeof calculateSeasonalPlan>
