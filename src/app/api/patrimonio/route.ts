import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assetNetWorthContribution, historicalChange } from '@/lib/patrimonio/linked-assets'

const assetSchema = z.object({
  name: z.string().trim().min(1).max(120),
  provider: z.string().trim().max(120).nullable().optional(),
  assetType: z.enum(['investment', 'cash', 'pension', 'other']).default('investment'),
  instrument: z.string().trim().max(180).nullable().optional(),
  investedAmount: z.coerce.number().finite().min(0).default(0),
  currentValue: z.coerce.number().finite().min(0),
  currency: z.string().trim().min(3).max(3).default('EUR'),
  sourceType: z.enum(['MANUAL', 'SCALABLE', 'SCREENSHOT', 'POSTE']).default('MANUAL'),
  includeInNetWorth: z.boolean().default(true),
  notes: z.string().trim().max(1000).nullable().optional(),
  observedAt: z.string().datetime().optional(),
})

function historyBaseline(
  snapshots: Array<{ consolidated_value: number | string; observed_at: string }>,
  daysAgo: number,
) {
  const target = Date.now() - daysAgo * 86_400_000
  const candidate = snapshots.find((snapshot) => new Date(snapshot.observed_at).getTime() <= target)
  return candidate ? Number(candidate.consolidated_value || 0) : null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const since = new Date(Date.now() - 95 * 86_400_000).toISOString()
  const [assetsRes, accountsRes, snapshotsRes, patrimonioSnapshotsRes] = await Promise.all([
    supabase
      .from('external_assets')
      .select('id,name,provider,asset_type,instrument,invested_amount,current_value,currency,source_type,include_in_net_worth,notes,observed_at,created_at,updated_at,linked_account_id')
      .eq('user_id', user.id)
      .order('current_value', { ascending: false }),
    supabase
      .from('accounts')
      .select('id,name,balance')
      .eq('user_id', user.id),
    supabase
      .from('external_asset_snapshots')
      .select('asset_id,current_value,observed_at')
      .eq('user_id', user.id)
      .gte('observed_at', since)
      .order('observed_at', { ascending: false }),
    supabase
      .from('patrimonio_snapshots')
      .select('consolidated_value,observed_at')
      .eq('user_id', user.id)
      .gte('observed_at', since)
      .order('observed_at', { ascending: false }),
  ])

  if (assetsRes.error) return NextResponse.json({ error: 'ASSETS_READ_FAILED' }, { status: 500 })
  if (accountsRes.error) return NextResponse.json({ error: 'ACCOUNTS_READ_FAILED' }, { status: 500 })

  const accounts = new Map(
    (accountsRes.data ?? []).map((account) => [
      String(account.id),
      { name: String(account.name), balance: Number(account.balance ?? 0) },
    ]),
  )

  const snapshotsByAsset = new Map<string, Array<{ asset_id: string; current_value: number | string; observed_at: string }>>()
  for (const snapshot of snapshotsRes.data ?? []) {
    const key = String(snapshot.asset_id)
    const list = snapshotsByAsset.get(key) ?? []
    list.push({
      asset_id: key,
      current_value: snapshot.current_value,
      observed_at: String(snapshot.observed_at),
    })
    snapshotsByAsset.set(key, list)
  }

  const assets = (assetsRes.data ?? []).map((asset) => {
    const linked = asset.linked_account_id ? accounts.get(String(asset.linked_account_id)) ?? null : null
    const current = Number(asset.current_value || 0)
    const snapshots = snapshotsByAsset.get(String(asset.id)) ?? []
    return {
      ...asset,
      linked_account_name: linked?.name ?? null,
      linked_account_balance: linked?.balance ?? null,
      net_worth_contribution: assetNetWorthContribution(asset, linked?.balance ?? null),
      change_7d: historicalChange(current, snapshots, 7),
      change_30d: historicalChange(current, snapshots, 30),
      change_90d: historicalChange(current, snapshots, 90),
      history: snapshots
        .map((snapshot) => ({
          value: Number(snapshot.current_value || 0),
          observedAt: snapshot.observed_at,
        }))
        .sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime()),
    }
  })

  const included = assets.filter((asset) => asset.include_in_net_worth)
  const externalValue = included.reduce((sum, asset) => sum + Number(asset.current_value || 0), 0)
  const investedAmount = included.reduce((sum, asset) => sum + Number(asset.invested_amount || 0), 0)
  const netWorthAdjustment = included.reduce((sum, asset) => sum + Number(asset.net_worth_contribution || 0), 0)
  const patrimonioSnapshots = (patrimonioSnapshotsRes.data ?? []).map((row) => ({
    consolidated_value: row.consolidated_value,
    observed_at: String(row.observed_at),
  }))

  return NextResponse.json({
    data: assets,
    summary: {
      externalValue,
      investedAmount,
      gainLoss: externalValue - investedAmount,
      netWorthAdjustment,
      includedAssets: included.length,
      historyBaseline7d: historyBaseline(patrimonioSnapshots, 7),
      historyBaseline30d: historyBaseline(patrimonioSnapshots, 30),
      historyBaseline90d: historyBaseline(patrimonioSnapshots, 90),
      history: patrimonioSnapshots
        .map((snapshot) => ({
          value: Number(snapshot.consolidated_value || 0),
          observedAt: snapshot.observed_at,
        }))
        .sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime()),
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
  const observedAt = value.observedAt || new Date().toISOString()
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
      observed_at: observedAt,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: 'ASSET_CREATE_FAILED' }, { status: 500 })

  await supabase.from('external_asset_snapshots').insert({
    user_id: user.id,
    asset_id: data.id,
    current_value: value.currentValue,
    linked_account_balance: null,
    observed_at: observedAt,
  })

  return NextResponse.json({ data }, { status: 201 })
}
