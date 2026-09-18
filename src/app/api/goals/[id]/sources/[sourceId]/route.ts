import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type RouteContext = { params: Promise<{ id: string; sourceId: string }> }

export async function DELETE(_request: Request, context: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { id, sourceId } = await context.params
  if (!uuidRe.test(id) || !uuidRe.test(sourceId)) {
    return NextResponse.json({ error: 'INVALID_ID' }, { status: 400 })
  }

  const { error } = await supabase
    .from('goal_linked_sources')
    .delete()
    .eq('id', sourceId)
    .eq('goal_id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[aurora-goals] linked source delete', { code: error.code })
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ data: { id: sourceId } }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}
