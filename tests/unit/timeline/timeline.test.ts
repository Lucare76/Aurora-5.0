import { describe, expect, it } from 'vitest'
import {
  filterTimelineEvents,
  formatTimelinePeriod,
  groupTimelineByYearMonth,
  isValidDateOnly,
  normalizeTimelineTags,
  timelineFingerprint,
  timelineInputSchema,
  timelineStatistics,
  type PersonalTimelineEvent,
} from '@/lib/timeline'

const base: PersonalTimelineEvent = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: 'user-1',
  event_date: '2026-08-09',
  end_date: null,
  title: 'Visita di controllo',
  description: 'Controllo annuale',
  category: 'HEALTH',
  subject: 'SELF',
  location: 'Roma',
  provider: 'Policlinico',
  tags: ['controllo'],
  importance: 'NORMAL',
  created_at: '2026-08-09T10:00:00.000Z',
  updated_at: '2026-08-09T10:00:00.000Z',
}

function event(overrides: Partial<PersonalTimelineEvent>): PersonalTimelineEvent {
  return { ...base, ...overrides }
}

describe('timeline helpers', () => {
  it('valida evento singolo e intervallo', () => {
    expect(timelineInputSchema.safeParse({
      title: 'Viaggio',
      subject: 'FAMILY',
      category: 'TRAVEL',
      event_date: '2026-08-09',
      end_date: '2026-08-12',
      importance: 'HIGH',
    }).success).toBe(true)
    expect(formatTimelinePeriod(event({ event_date: '2026-08-09', end_date: null }))).toBe('09/08/2026')
    expect(formatTimelinePeriod(event({ event_date: '2026-08-09', end_date: '2026-08-12' }))).toBe('09/08/2026 - 12/08/2026')
  })

  it('rifiuta data fine precedente alla data iniziale', () => {
    expect(timelineInputSchema.safeParse({
      title: 'Evento',
      subject: 'SELF',
      category: 'OTHER',
      event_date: '2026-08-12',
      end_date: '2026-08-09',
    }).success).toBe(false)
  })

  it('raggruppa per anno e mese ordinando dal piu recente', () => {
    const groups = groupTimelineByYearMonth([
      event({ id: 'a', event_date: '2025-12-01' }),
      event({ id: 'b', event_date: '2026-07-01' }),
      event({ id: 'c', event_date: '2026-08-09' }),
    ])
    expect(groups.map((group) => group.year)).toEqual([2026, 2025])
    expect(groups[0].months.map((month) => month.monthKey)).toEqual(['2026-08', '2026-07'])
    expect(groups[0].months[0].events[0].id).toBe('c')
  })

  it('filtra per soggetto, categoria e ricerca', () => {
    const events = [
      event({ id: 'self', subject: 'SELF', category: 'HEALTH', title: 'Visita' }),
      event({ id: 'aurora', subject: 'AURORA', category: 'SCHOOL', title: 'Scuola' }),
    ]
    expect(filterTimelineEvents(events, { subject: 'AURORA' }).map((item) => item.id)).toEqual(['aurora'])
    expect(filterTimelineEvents(events, { category: 'HEALTH' }).map((item) => item.id)).toEqual(['self'])
    expect(filterTimelineEvents(events, { search: 'scuo' }).map((item) => item.id)).toEqual(['aurora'])
  })

  it('normalizza tag e rimuove duplicati', () => {
    expect(normalizeTimelineTags(' Controllo, controllo, Visita medica!, ')).toEqual(['controllo', 'visita-medica'])
  })

  it('calcola statistiche e soggetto piu frequente', () => {
    const stats = timelineStatistics([
      event({ id: '1', subject: 'AURORA', category: 'SCHOOL', event_date: '2026-01-01' }),
      event({ id: '2', subject: 'AURORA', category: 'HEALTH', event_date: '2025-01-01' }),
      event({ id: '3', subject: 'SELF', category: 'HEALTH', event_date: '2026-02-01' }),
    ], new Date('2026-08-09T12:00:00+02:00'))
    expect(stats.total).toBe(3)
    expect(stats.currentYear).toBe(2)
    expect(stats.bySubject.AURORA).toBe(2)
    expect(stats.mostFrequentSubject).toBe('AURORA')
  })

  it('usa fingerprint restore conservativo', () => {
    expect(timelineFingerprint(event({ title: '  Visita   controllo  ' }))).toBe('2026-08-09|visita controllo|SELF|HEALTH')
  })

  it('gestisce date civili senza slittamento timezone', () => {
    expect(isValidDateOnly('2026-08-31')).toBe(true)
    expect(isValidDateOnly('2026-02-31')).toBe(false)
    expect(formatTimelinePeriod(event({ event_date: '2026-08-31' }))).toBe('31/08/2026')
  })
})
