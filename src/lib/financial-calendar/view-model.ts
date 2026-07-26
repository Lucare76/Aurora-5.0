import type { CalendarDay, CriticalDay, FinancialCalendarEvent } from './types'
import { formatCurrency } from '@/lib/utils'

export type CalendarViewport = 'desktop' | 'tablet' | 'mobile'

export function maxEventsForViewport(viewport: CalendarViewport): number {
  if (viewport === 'mobile') return 1
  if (viewport === 'tablet') return 2
  return 3
}

export function visibleEvents(events: FinancialCalendarEvent[], viewport: CalendarViewport) {
  const max = maxEventsForViewport(viewport)
  return {
    visible: events.slice(0, max),
    hiddenCount: Math.max(0, events.length - max),
  }
}

export function eventDirectionSymbol(event: FinancialCalendarEvent): string {
  if (event.direction === 'INCOME') return '+'
  if (event.direction === 'EXPENSE') return '-'
  return '•'
}

export function eventTypeLabel(event: FinancialCalendarEvent): string {
  switch (event.sourceType) {
    case 'RECURRING': return 'Ricorrenza'
    case 'LOAN': return 'Prestito'
    case 'BUDGET': return 'Budget'
    case 'SAVINGS_GOAL': return 'Obiettivo'
    case 'EXISTING_TRANSACTION': return 'Movimento'
  }
}

export function dayWarningLabel(warnings: CriticalDay[]): string {
  if (warnings.length === 0) return 'nessuna criticità'
  const danger = warnings.find((warning) => warning.severity === 'DANGER')
  const warning = danger ?? warnings[0]
  return warning.message
}

export function calendarDayAriaLabel(day: CalendarDay): string {
  if (day.day === 0) return 'Giorno vuoto'
  const date = new Date(`${day.date}T00:00:00`).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const eventText = day.eventCount === 1 ? '1 evento' : `${day.eventCount} eventi`
  return `${date}, ${eventText}, saldo previsto ${formatCurrency(day.closingBalance)}, ${dayWarningLabel(day.warnings)}`
}

export function eventAriaLabel(event: FinancialCalendarEvent): string {
  const amount = event.amount === null ? 'importo non disponibile' : formatCurrency(event.amount)
  return `${eventTypeLabel(event)}: ${event.title}, ${amount}, stato ${event.status}`
}

export function compactBalance(balance: number): string {
  return formatCurrency(balance).replace(',00', '')
}
