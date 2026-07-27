import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DataIntegrityError, getDataIntegrityIssue } from '@/lib/data-integrity/service'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return json({ error: 'UNAUTHORIZED' }, 401)

  try {
    const { id } = await context.params
    const issue = await getDataIntegrityIssue(supabase, user.id, id)
    return json({ issue }, 200)
  } catch (err) {
    if (err instanceof DataIntegrityError) return json({ error: err.code }, 404)
    return json({ error: 'ISSUE_NOT_FOUND' }, 404)
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
