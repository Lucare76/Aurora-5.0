import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { data, error } = await supabase
    .from('scalable_connections')
    .select('connected_at,last_synced_at,last_error,scope,expires_at,metadata')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'SCALABLE_STATUS_FAILED' }, { status: 500 })

  return NextResponse.json({
    connected: Boolean(data),
    connection: data ?? null,
    configured: Boolean(process.env.SCALABLE_TOKEN_ENCRYPTION_KEY),
  })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { error } = await supabase
    .from('scalable_connections')
    .delete()
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'SCALABLE_DISCONNECT_FAILED' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
