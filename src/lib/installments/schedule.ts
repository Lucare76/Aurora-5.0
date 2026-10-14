import type { CalendarAccountInput, CalendarCategoryInput, FinancialCalendarEvent } from '@/lib/financial-calendar/types'

export type InstallmentSchedule = {
  amount: number
  frequency: 'monthly' | 'weekly'
  interval: number
  first_due_date: string
  first_installment_number: number
  paused: boolean
}
export type InstallmentPlan = {
  id: string; title: string; total_installments: number; created_at: string
  schedule?: InstallmentSchedule | null
}
export type InstallmentPayment = {
  transaction_id: string; plan_id: string; installment_number: number
  transaction?: {
    account_id: string; category_id: string | null; amount: number | string
    date: string; description: string | null; recurring_id: string | null
  } | null
}

export function unpaidNumbers(plan: InstallmentPlan, payments: InstallmentPayment[]): number[] {
  const paid = new Set(payments.filter((p) => p.plan_id === plan.id).map((p) => p.installment_number))
  // Legacy plans can begin at installment 2 or 3: earlier numbers were already paid.
  const first = plan.schedule?.first_installment_number ?? Math.max(0, ...paid) + 1
  return Array.from({ length: Math.max(0, plan.total_installments - first + 1) }, (_, i) => first + i).filter((n) => !paid.has(n))
}

export function installmentDate(schedule: InstallmentSchedule, number: number): string {
  const [year, month, day] = schedule.first_due_date.split('-').map(Number)
  const offset = (number - schedule.first_installment_number) * schedule.interval
  const date = schedule.frequency === 'weekly'
    ? new Date(Date.UTC(year, month - 1, day + offset * 7))
    : new Date(Date.UTC(year, month - 1 + offset, Math.min(day, new Date(Date.UTC(year, month + offset, 0)).getUTCDate())))
  return date.toISOString().slice(0, 10)
}

export function latestPayment(planId: string, payments: InstallmentPayment[]) {
  return payments.filter((p) => p.plan_id === planId && p.transaction).sort((a, b) => b.installment_number - a.installment_number)[0]
}

/** Pure projections: no transactions are created, and paid numbers are always excluded. */
export function addInstallmentEvents(params: {
  plans: InstallmentPlan[]; payments: InstallmentPayment[]; events: FinancialCalendarEvent[]
  accounts: CalendarAccountInput[]; categories: CalendarCategoryInput[]
  from: string; to: string; today: string
}): FinancialCalendarEvent[] {
  const windows: Array<{ ids: Set<string>; from: string; to: string }> = []
  const installments: FinancialCalendarEvent[] = []
  for (const plan of params.plans) {
    const schedule = plan.schedule
    if (!schedule || schedule.paused) continue
    const transaction = latestPayment(plan.id, params.payments)?.transaction
    const account = params.accounts.find((a) => a.id === transaction?.account_id && a.is_active)
    if (!transaction || !account) continue
    // A linked recurring rule represents the same purchase: replace its occurrences
    // only within this finite plan, including installments paid ahead of time.
    windows.push({
      ids: new Set(params.payments.filter((p) => p.plan_id === plan.id).flatMap((p) => p.transaction?.recurring_id ? [p.transaction.recurring_id] : [])),
      from: schedule.first_due_date, to: installmentDate(schedule, plan.total_installments),
    })
    const category = params.categories.find((c) => c.id === transaction.category_id)
    for (const number of unpaidNumbers(plan, params.payments)) {
      const due = installmentDate(schedule, number)
      // Unpaid overdue installments remain visible and affect today's forecast.
      const date = due < params.today ? params.today : due
      if (date < params.from || date > params.to) continue
      installments.push({
        id: `installment:${plan.id}:${number}`, sourceId: plan.id, sourceType: 'INSTALLMENT',
        eventType: 'INSTALLMENT_DUE', title: `${plan.title} · rata ${number}/${plan.total_installments}`,
        description: due < params.today ? `Rata ancora da collegare, scadenza ${due.split('-').reverse().join('/')}` : 'Rata prevista: collega l’addebito nei Movimenti quando viene pagata.',
        date, amount: schedule.amount, direction: 'EXPENSE', accountId: account.id, accountName: account.name,
        categoryId: category?.id ?? null, categoryName: category?.name ?? null,
        status: due < params.today ? 'OVERDUE' : 'EXPECTED', confidence: 'HIGH',
        href: `/transactions#piani-rateali`,
        metadata: { installmentNumber: number, dueDate: due, scheduled: true },
      })
    }
  }
  return [...params.events.filter((event) => event.sourceType !== 'RECURRING' ||
    !windows.some((w) => w.ids.has(event.sourceId) && event.date >= w.from && event.date <= w.to)), ...installments]
}
