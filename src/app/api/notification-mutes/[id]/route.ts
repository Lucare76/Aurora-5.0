import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deleteSourceMute, getSourceMute } from '@/lib/notifications/preferences-service'

export const dynamic = 'force-dynamic'

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { id } = await params
  if (!id) return json({ error: 'SOURCE_MUTE_NOT_FOUND' }, 404)

  // Verify ownership before delete
  const mute = await getSourceMute(supabase, user.id, id)
  if (!mute) return json({ error: 'SOURCE_MUTE_NOT_FOUND' }, 404)

  try {
    await deleteSourceMute(supabase, user.id, id)
    return json({ data: { deleted: true } }, 200)
  } catch {
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}
