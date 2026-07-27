import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateScenarioSchema } from '@/lib/scenarios/schemas'
import { getScenario, updateScenario, deleteScenario } from '@/lib/scenarios/persistence'

export const dynamic = 'force-dynamic'

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { id } = await params
  try {
    const scenario = await getScenario(supabase, user.id, id)
    if (!scenario) return json({ error: 'NOT_FOUND' }, 404)
    return json({ data: scenario }, 200)
  } catch (err) {
    console.error('[aurora-scenarios] get', err)
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { id } = await params

  let body: unknown
  try { body = await request.json() }
  catch { return json({ error: 'INVALID_BODY' }, 400) }

  const parsed = updateScenarioSchema.safeParse(body)
  if (!parsed.success) return json({ error: 'VALIDATION_ERROR', details: parsed.error.issues }, 400)

  try {
    const scenario = await updateScenario(supabase, user.id, id, parsed.data as never)
    return json({ data: scenario }, 200)
  } catch (err) {
    const pg = err as { code?: string; message?: string }
    if (pg?.message?.includes('not found') || pg?.code === 'PGRST116') return json({ error: 'NOT_FOUND' }, 404)
    console.error('[aurora-scenarios] patch', err)
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const { id } = await params
  try {
    await deleteScenario(supabase, user.id, id)
    return json({ success: true }, 200)
  } catch (err) {
    console.error('[aurora-scenarios] delete', err)
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}
