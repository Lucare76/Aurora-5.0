import { describe, expect, it } from 'vitest'
import {
  calendarDayAriaLabel,
  compactBalance,
  eventAriaLabel,
  eventDirectionSymbol,
  maxEventsForViewport,
  visibleEvents,
} from '@/lib/financial-calendar/view-model'
import type { CalendarDay, FinancialCalendarEvent } from '@/lib/financial-calendar/types'

function event(overrides: Partial<FinancialCalendarEvent> = {}): FinancialCalendarEvent {
  return {
    id: overrides.id ?? 'event-1',
    sourceId: overrides.sourceId ?? 'source-1',
    sourceType: overrides.sourceType ?? 'RECURRING',
    eventType: overrides.eventType ?? 'EXPECTED_EXPENSE',
    title: overrides.title ?? 'Titolo molto lungo che deve essere disponibile nel tooltip',
    description: null,
    date: overrides.date ?? '2026-07-12',
    amount: overrides.amount ?? 123.45,
    direction: overrides.direction ?? 'EXPENSE',
    accountId: null,
    accountName: overrides.accountName ?? 'Banca',
    categoryId: null,
    categoryName: overrides.categoryName ?? 'Casa',
    status: overrides.status ?? 'EXPECTED',
    confidence: 'HIGH',
    href: '/recurring',
    metadata: {},
  }
}

function day(overrides: Partial<CalendarDay> = {}): CalendarDay {
  return {
    date: overrides.date ?? '2026-07-12',
    day: overrides.day ?? 12,
    inCurrentMonth: overrides.inCurrentMonth ?? true,
    isToday: overrides.isToday ?? false,
    openingBalance: overrides.openingBalance ?? 1000,
    income: overrides.income ?? 0,
    expenses: overrides.expenses ?? 0,
    closingBalance: overrides.closingBalance ?? 876.55,
    eventCount: overrides.eventCount ?? (overrides.events?.length ?? 0),
    events: overrides.events ?? [],
    warnings: overrides.warnings ?? [],
  }
}

describe('financial calendar view model', () => {
  it('limits visible events by responsive viewport', () => {
    expect(maxEventsForViewport('desktop')).toBe(3)
    expect(maxEventsForViewport('tablet')).toBe(2)
    expect(maxEventsForViewport('mobile')).toBe(1)
  })

  it('returns +N hidden event counts for crowded days', () => {
    const events = Array.from({ length: 6 }, (_, index) => event({ id: `event-${index}` }))
    expect(visibleEvents(events, 'desktop')).toMatchObject({ hiddenCount: 3 })
    expect(visibleEvents(events, 'tablet')).toMatchObject({ hiddenCount: 4 })
    expect(visibleEvents(events, 'mobile')).toMatchObject({ hiddenCount: 5 })
  })

  it('keeps long titles available in event aria labels', () => {
    const item = event({ title: 'RATA MUTUO CASA CON DESCRIZIONE LUNGHISSIMA' })
    expect(eventAriaLabel(item)).toContain('RATA MUTUO CASA CON DESCRIZIONE LUNGHISSIMA')
    expect(eventAriaLabel(item)).toContain('Ricorrenza')
  })

  it('uses non-color direction symbols for income expense and neutral events', () => {
    expect(eventDirectionSymbol(event({ direction: 'INCOME' }))).toBe('+')
    expect(eventDirectionSymbol(event({ direction: 'EXPENSE' }))).toBe('-')
    expect(eventDirectionSymbol(event({ direction: 'NEUTRAL' }))).toBe('•')
  })

  it('builds day aria labels with event count balance and warnings', () => {
    const label = calendarDayAriaLabel(day({
      events: [event(), event({ id: 'event-2' }), event({ id: 'event-3' })],
      eventCount: 3,
      warnings: [{ date: '2026-07-12', type: 'BELOW_THRESHOLD', severity: 'WARNING', message: 'Saldo sotto soglia', amount: 50 }],
    }))
    expect(label).toContain('12 luglio 2026')
    expect(label).toContain('3 eventi')
    expect(label).toContain('Saldo sotto soglia')
  })

  it('formats large and negative balances compactly without changing values', () => {
    expect(compactBalance(182237.95)).toContain('182.237')
    expect(compactBalance(-50.25)).toContain('-50')
  })
})
