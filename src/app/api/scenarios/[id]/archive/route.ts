import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateScenario } from '@/lib/scenarios/persistence'

export const dynamic = 'force-dynamic'

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { id } = await params
  try {
    const scenario = await updateScenario(supabase, user.id, id, { status: 'archived' })
    return json({ data: scenario }, 200)
  } catch (err) {
    const pg = err as { code?: string }
    if (pg?.code === 'PGRST116') return json({ error: 'NOT_FOUND' }, 404)
    console.error('[aurora-scenarios] archive', err)
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}
