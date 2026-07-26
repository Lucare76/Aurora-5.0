import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'src/app/(app)/calendar/page.tsx'), 'utf8')

describe('financial calendar responsive markup', () => {
  it('keeps a 7-column calendar grid only for desktop', () => {
    expect(source).toContain('data-calendar-grid="desktop"')
    expect(source).not.toContain('data-calendar-grid="tablet"')
    expect(source).not.toContain('data-calendar-grid="mobile"')
    expect(source).toContain('hidden space-y-6 lg:block')
    expect(source).toMatch(/grid-cols-7/g)
  })

  it('uses agenda cards below the lg breakpoint instead of a mobile month grid', () => {
    expect(source).toContain('block lg:hidden')
    expect(source).toContain('data-calendar-agenda')
    expect(source).toContain('data-agenda-day-card')
    expect(source).toContain('AgendaDayCard')
    expect(source).not.toContain('MobileDayCell')
  })

  it('keeps the selected day panel below the desktop calendar and removes the sticky side panel', () => {
    expect(source).not.toContain('xl:sticky')
    expect(source).not.toContain('<aside')
    expect(source).toContain('SelectedDayPanel selectedDay={selectedDay}')
  })

  it('limits desktop day cells to three visible events and exposes the hidden count', () => {
    const dayCell = source.slice(source.indexOf('function CalendarDayCell'), source.indexOf('function AgendaDayCard'))
    expect(dayCell).toContain("visibleEvents(day.events, 'desktop')")
    expect(dayCell).toContain('+{hiddenCount} altri')
  })

  it('keeps the responsive agenda on the same fetched payload', () => {
    expect(source.split('fetch(`/api/financial-calendar').length - 1).toBe(1)
    expect(source).toContain('<AgendaView payload={payload} />')
  })

  it('keeps mobile filters collapsible and preserves month navigation and today actions', () => {
    expect(source).toContain('<details')
    expect(source).toContain('Filtri agenda')
    expect(source).toContain('Mese precedente')
    expect(source).toContain('Mese successivo')
    expect(source).toContain('Oggi')
  })
})
