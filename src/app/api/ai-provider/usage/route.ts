import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchAiUsageSummary } from '@/lib/financial-assistant/usage/service'

export const dynamic = 'force-dynamic'

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  try {
    return json({ data: await fetchAiUsageSummary({ supabase, userId: user.id }) }, 200)
  } catch {
    return json({ error: 'AI_USAGE_UNAVAILABLE', message: 'Utilizzo AI non disponibile.' }, 500)
  }
}
