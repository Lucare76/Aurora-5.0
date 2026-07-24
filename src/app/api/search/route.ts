import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH, normalizeSearchQuery, searchAurora } from '@/lib/search/service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const url = new URL(request.url)
  const queries = url.searchParams.getAll('q')
  if (queries.length !== 1) return json({ error: 'INVALID_QUERY' }, 400)

  const query = normalizeSearchQuery(queries[0] ?? '')
  if (!query) return json({ error: 'INVALID_QUERY' }, 400)
  if (query.length < MIN_QUERY_LENGTH) return json({ error: 'QUERY_TOO_SHORT' }, 400)
  if ((queries[0] ?? '').length > MAX_QUERY_LENGTH) return json({ error: 'QUERY_TOO_LONG' }, 400)

  try {
    const payload = await searchAurora(supabase, query, user.id)
    return json(payload, 200)
  } catch (err) {
    console.error('[aurora-search]', { code: (err as { code?: string })?.code })
    return json({ error: 'SEARCH_FAILED' }, 500)
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
