import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { recordConsolidatedPatrimonioSnapshot } from '@/lib/patrimonio/record-consolidated-snapshot'

const schema = z.object({
  observedAt: z.string().datetime(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_SNAPSHOT_DATE' }, { status: 400 })
  }

  try {
    const snapshot = await recordConsolidatedPatrimonioSnapshot(
      supabase,
      user,
      parsed.data.observedAt,
    )
    return NextResponse.json({ ok: true, snapshot })
  } catch {
    return NextResponse.json({ error: 'PATRIMONIO_SNAPSHOT_FAILED' }, { status: 500 })
  }
}
