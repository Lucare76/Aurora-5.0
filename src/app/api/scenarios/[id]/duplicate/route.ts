import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { duplicateScenario } from '@/lib/scenarios/persistence'

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
    const copy = await duplicateScenario(supabase, user.id, id)
    return json({ data: copy }, 201)
  } catch (err) {
    const e = err as { message?: string }
    if (e?.message === 'Scenario not found') return json({ error: 'NOT_FOUND' }, 404)
    console.error('[aurora-scenarios] duplicate', err)
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}
