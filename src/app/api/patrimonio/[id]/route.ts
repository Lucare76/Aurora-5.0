import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  provider: z.string().trim().max(120).nullable().optional(),
  assetType: z.enum(['investment', 'cash', 'pension', 'other']).optional(),
  instrument: z.string().trim().max(180).nullable().optional(),
  investedAmount: z.coerce.number().finite().min(0).optional(),
  currentValue: z.coerce.number().finite().min(0).optional(),
  sourceType: z.enum(['MANUAL', 'SCALABLE', 'SCREENSHOT']).optional(),
  includeInNetWorth: z.boolean().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  observedAt: z.string().datetime().optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const { id } = await params

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_ASSET', details: parsed.error.flatten() }, { status: 400 })

  const value = parsed.data
  const patch: Record<string, unknown> = {}
  if (value.name !== undefined) patch.name = value.name
  if (value.provider !== undefined) patch.provider = value.provider || null
  if (value.assetType !== undefined) patch.asset_type = value.assetType
  if (value.instrument !== undefined) patch.instrument = value.instrument || null
  if (value.investedAmount !== undefined) patch.invested_amount = value.investedAmount
  if (value.currentValue !== undefined) patch.current_value = value.currentValue
  if (value.sourceType !== undefined) patch.source_type = value.sourceType
  if (value.includeInNetWorth !== undefined) patch.include_in_net_worth = value.includeInNetWorth
  if (value.notes !== undefined) patch.notes = value.notes || null
  if (value.observedAt !== undefined) patch.observed_at = value.observedAt

  const { data: updated, error } = await supabase
    .from('external_assets')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id,current_value,linked_account_id,observed_at')
    .single()

  if (error) return NextResponse.json({ error: 'ASSET_UPDATE_FAILED' }, { status: 500 })

  if (value.currentValue !== undefined && updated) {
    let linkedAccountBalance: number | null = null
    if (updated.linked_account_id) {
      const { data: account } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', updated.linked_account_id)
        .eq('user_id', user.id)
        .maybeSingle()
      linkedAccountBalance = account ? Number(account.balance ?? 0) : null
    }

    await supabase.from('external_asset_snapshots').insert({
      user_id: user.id,
      asset_id: updated.id,
      current_value: Number(updated.current_value ?? 0),
      linked_account_balance: linkedAccountBalance,
      observed_at: updated.observed_at,
    })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const { id } = await params

  const { error } = await supabase
    .from('external_assets')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'ASSET_DELETE_FAILED' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
