import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { DataIntegrityError, runDataIntegrityScan } from '@/lib/data-integrity/service'

export const dynamic = 'force-dynamic'

const scanSchema = z.object({
  mode: z.enum(['quick', 'full', 'targeted']).default('quick'),
}).strict()

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return json({ error: 'UNAUTHORIZED' }, 401)

  const body = await request.json().catch(() => ({}))
  const parsed = scanSchema.safeParse(body)
  if (!parsed.success) return json({ error: 'INVALID_SCAN_REQUEST' }, 400)

  try {
    const result = await runDataIntegrityScan(supabase, user.id, parsed.data.mode)
    return json(result, 200)
  } catch (err) {
    if (err instanceof DataIntegrityError) return json({ error: err.code }, err.code === 'DATASET_TOO_LARGE' ? 413 : 500)
    console.error('[data-integrity:scan]', { name: err instanceof Error ? err.name : 'unknown' })
    return json({ error: 'SCAN_FAILED' }, 500)
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
