import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deleteContribution } from '@/lib/goals/service'

export const dynamic = 'force-dynamic'

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type RouteContext = { params: Promise<{ id: string }> }

export async function DELETE(_request: Request, context: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { id } = await context.params
  if (!uuidRe.test(id)) return json({ error: 'INVALID_ID' }, 400)

  const { data: contribution } = await supabase
    .from('goal_contributions')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (!contribution) return json({ error: 'GOAL_NOT_FOUND' }, 404)

  try {
    await deleteContribution(supabase, id)
    return json({ data: { id } }, 200)
  } catch (err) {
    console.error('[aurora-goals] contribution delete', { code: (err as { code?: string })?.code })
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
