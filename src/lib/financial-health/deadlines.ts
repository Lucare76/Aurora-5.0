import { roundMoney, roundScore } from './helpers'
import type { ComponentScore, HealthLoan, HealthRecurringItem } from './types'

export type DeadlineHealthSummary = {
  upcoming7d: number
  upcoming30d: number
  upcomingAmount30d: number
  overdueCount: number
  overdueAmount: number
  totalTrackedDeadlines: number
}

function diffDays(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000)
}

export function summarizeDeadlines(params: {
  recurringItems: HealthRecurringItem[]
  loans: HealthLoan[]
  today: string
}): DeadlineHealthSummary {
  let upcoming7d = 0
  let upcoming30d = 0
  let upcomingAmount30d = 0
  let overdueCount = 0
  let overdueAmount = 0
  const track = (date: string | null, amount: number) => {
    if (!date) return
    const diff = diffDays(params.today, date)
    if (diff < 0) {
      overdueCount += 1
      overdueAmount = roundMoney(overdueAmount + amount)
    } else {
      if (diff <= 7) upcoming7d += 1
      if (diff <= 30) {
        upcoming30d += 1
        upcomingAmount30d = roundMoney(upcomingAmount30d + amount)
      }
    }
  }

  for (const item of params.recurringItems.filter((item) => item.is_active)) track(item.next_due_date, item.type === 'expense' ? item.amount : 0)
  for (const loan of params.loans.filter((loan) => !loan.is_settled)) track(loan.due_date, loan.remaining)

  return { upcoming7d, upcoming30d, upcomingAmount30d, overdueCount, overdueAmount, totalTrackedDeadlines: upcoming30d + overdueCount }
}

export function calculateDeadlineScore(summary: DeadlineHealthSummary, weight: number): ComponentScore {
  if (summary.totalTrackedDeadlines === 0) {
    return {
      component: 'deadlines',
      score: 100,
      weight,
      contribution: weight,
      availability: 'AVAILABLE',
      status: 'good',
      factors: [{ id: 'deadlines-none', component: 'deadlines', impact: 'POSITIVE', severity: 'INFO', title: 'Nessuna scadenza critica', description: 'Non risultano scadenze scadute o imminenti nel periodo osservato.' }],
    }
  }
  const finalScore = roundScore(100 - summary.overdueCount * 25 - Math.max(0, summary.upcoming7d - 3) * 5)
  return {
    component: 'deadlines',
    score: finalScore,
    weight,
    contribution: roundMoney((finalScore / 100) * weight),
    availability: 'AVAILABLE',
    status: finalScore >= 75 ? 'good' : finalScore >= 50 ? 'watch' : 'risk',
    factors: summary.overdueCount > 0
      ? [{ id: 'deadlines-overdue', component: 'deadlines', impact: 'NEGATIVE', severity: 'CRITICAL', title: 'Scadenze da verificare', description: 'Sono presenti scadenze passate nei dati registrati.', metricValue: summary.overdueCount, metricUnit: 'scadenze' }]
      : [{ id: 'deadlines-upcoming', component: 'deadlines', impact: 'NEUTRAL', severity: 'INFO', title: 'Scadenze in arrivo', description: 'Le scadenze future sono informative e non vengono penalizzate automaticamente.', metricValue: summary.upcoming30d, metricUnit: 'scadenze' }],
  }
}
