import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const assetSchema = z.object({
  name: z.string().trim().min(1).max(120),
  provider: z.string().trim().max(120).nullable().optional(),
  assetType: z.enum(['investment', 'cash', 'pension', 'other']).default('investment'),
  instrument: z.string().trim().max(180).nullable().optional(),
  investedAmount: z.coerce.number().finite().min(0).default(0),
  currentValue: z.coerce.number().finite().min(0),
  currency: z.string().trim().min(3).max(3).default('EUR'),
  sourceType: z.enum(['MANUAL', 'SCALABLE', 'SCREENSHOT']).default('MANUAL'),
  includeInNetWorth: z.boolean().default(true),
  notes: z.string().trim().max(1000).nullable().optional(),
  observedAt: z.string().datetime().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { data, error } = await supabase
    .from('external_assets')
    .select('id,name,provider,asset_type,instrument,invested_amount,current_value,currency,source_type,include_in_net_worth,notes,observed_at,created_at,updated_at')
    .eq('user_id', user.id)
    .order('current_value', { ascending: false })

  if (error) return NextResponse.json({ error: 'ASSETS_READ_FAILED' }, { status: 500 })

  const assets = data ?? []
  const included = assets.filter((asset) => asset.include_in_net_worth)
  const externalValue = included.reduce((sum, asset) => sum + Number(asset.current_value || 0), 0)
  const investedAmount = included.reduce((sum, asset) => sum + Number(asset.invested_amount || 0), 0)

  return NextResponse.json({
    data: assets,
    summary: {
      externalValue,
      investedAmount,
      gainLoss: externalValue - investedAmount,
      includedAssets: included.length,
    },
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const parsed = assetSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_ASSET', details: parsed.error.flatten() }, { status: 400 })

  const value = parsed.data
  const { data, error } = await supabase
    .from('external_assets')
    .insert({
      user_id: user.id,
      name: value.name,
      provider: value.provider || null,
      asset_type: value.assetType,
      instrument: value.instrument || null,
      invested_amount: value.investedAmount,
      current_value: value.currentValue,
      currency: value.currency.toUpperCase(),
      source_type: value.sourceType,
      include_in_net_worth: value.includeInNetWorth,
      notes: value.notes || null,
      observed_at: value.observedAt || new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: 'ASSET_CREATE_FAILED' }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
