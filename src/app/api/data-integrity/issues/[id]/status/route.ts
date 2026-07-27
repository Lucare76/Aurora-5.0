import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { DataIntegrityError, updateDataIntegrityIssueStatus } from '@/lib/data-integrity/service'
import type { DataIntegrityStatus } from '@/lib/data-integrity/types'

export const dynamic = 'force-dynamic'

const statusSchema = z.object({
  status: z.enum(['open', 'acknowledged', 'ignored', 'resolved', 'stale']),
  reason: z.string().max(500).nullable().optional(),
}).strict()

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return json({ error: 'UNAUTHORIZED' }, 401)

  const parsed = statusSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: 'INVALID_STATUS_REQUEST' }, 400)

  try {
    const { id } = await context.params
    const issue = await updateDataIntegrityIssueStatus(supabase, user.id, id, parsed.data.status as DataIntegrityStatus, parsed.data.reason)
    return json({ issue }, 200)
  } catch (err) {
    if (err instanceof DataIntegrityError) return json({ error: err.code }, err.code === 'INVALID_STATUS' ? 400 : 404)
    return json({ error: 'ISSUE_UPDATE_FAILED' }, 500)
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
