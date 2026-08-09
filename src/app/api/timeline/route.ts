import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePrivateHrAccess } from '@/lib/access/private-finance-access'
import { timelineInputSchema, timelineQuerySchema, timelineStatistics } from '@/lib/timeline'
import type { PersonalTimelineEvent } from '@/types/database'

export const dynamic = 'force-dynamic'

const TIMELINE_SELECT = 'id,user_id,event_date,end_date,title,description,category,subject,location,provider,tags,importance,created_at,updated_at'

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function emptyToNull(value?: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function sanitizeSearch(value: string): string {
  return value.replace(/[%_,]/g, '').trim()
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)
  if (!requirePrivateHrAccess(user)) return json({ error: 'FORBIDDEN' }, 403)

  const url = new URL(request.url)
  const parsed = timelineQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) return json({ error: 'INVALID_TIMELINE_QUERY' }, 400)

  const { subject, category, year, search, limit, offset } = parsed.data
  let query = supabase
    .from('personal_timeline_events')
    .select(TIMELINE_SELECT, { count: 'exact' })
    .eq('user_id', user.id)

  let statsQuery = supabase
    .from('personal_timeline_events')
    .select('id,user_id,event_date,end_date,title,description,category,subject,location,provider,tags,importance,created_at,updated_at')
    .eq('user_id', user.id)

  if (subject) {
    query = query.eq('subject', subject)
    statsQuery = statsQuery.eq('subject', subject)
  }
  if (category) {
    query = query.eq('category', category)
    statsQuery = statsQuery.eq('category', category)
  }
  if (year) {
    query = query.gte('event_date', `${year}-01-01`).lte('event_date', `${year}-12-31`)
    statsQuery = statsQuery.gte('event_date', `${year}-01-01`).lte('event_date', `${year}-12-31`)
  }
  if (search) {
    const term = sanitizeSearch(search)
    if (term) {
      const searchFilter = `title.ilike.%${term}%,description.ilike.%${term}%,location.ilike.%${term}%,provider.ilike.%${term}%`
      query = query.or(searchFilter)
      statsQuery = statsQuery.or(searchFilter)
    }
  }

  const [{ data, error, count }, { data: statsData, error: statsError }] = await Promise.all([
    query
      .order('event_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),
    statsQuery.order('event_date', { ascending: false }),
  ])

  if (error) return json({ error: 'TIMELINE_UNAVAILABLE' }, 500)
  if (statsError) return json({ error: 'TIMELINE_STATS_UNAVAILABLE' }, 500)

  const events = (data ?? []) as PersonalTimelineEvent[]
  const statsEvents = (statsData ?? []) as PersonalTimelineEvent[]
  const years = [...new Set(statsEvents.map((event) => Number(event.event_date.slice(0, 4))))].sort((a, b) => b - a)

  return json({
    data: events,
    pagination: {
      limit,
      offset,
      total: count ?? events.length,
      hasMore: offset + events.length < (count ?? events.length),
    },
    years,
    stats: timelineStatistics(statsEvents),
  }, 200)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)
  if (!requirePrivateHrAccess(user)) return json({ error: 'FORBIDDEN' }, 403)

  let body: unknown
  try { body = await request.json() } catch { return json({ error: 'INVALID_JSON' }, 400) }
  const parsed = timelineInputSchema.safeParse(body)
  if (!parsed.success) return json({ error: 'INVALID_TIMELINE_EVENT', details: parsed.error.flatten() }, 400)

  const { data, error } = await supabase
    .from('personal_timeline_events')
    .insert({
      user_id: user.id,
      ...parsed.data,
      end_date: parsed.data.end_date || null,
      description: emptyToNull(parsed.data.description),
      location: emptyToNull(parsed.data.location),
      provider: emptyToNull(parsed.data.provider),
      tags: parsed.data.tags ?? [],
    })
    .select(TIMELINE_SELECT)
    .single()

  if (error) return json({ error: 'TIMELINE_SAVE_FAILED' }, 500)
  return json({ data }, 201)
}
