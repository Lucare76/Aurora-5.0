import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { recordConsolidatedPatrimonioSnapshot } from '@/lib/patrimonio/record-consolidated-snapshot'

const manualSchema = z.object({
  accountId: z.string().uuid(),
  productName: z.string().trim().min(1).max(120),
  currentValue: z.coerce.number().finite().min(0),
  observedAt: z.string().datetime().optional(),
  notes: z.string().trim().max(600).nullable().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { data, error } = await supabase
    .from('accounts')
    .select('id,name,type,balance,currency')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .eq('is_hidden', false)
    .in('type', ['investment', 'savings'])
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: 'POSTE_ACCOUNTS_READ_FAILED' }, { status: 500 })

  return NextResponse.json({
    data: (data ?? []).map((account) => ({
      id: String(account.id),
      name: String(account.name),
      type: String(account.type),
      balance: Number(account.balance ?? 0),
      currency: String(account.currency ?? 'EUR'),
    })),
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const parsed = manualSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'POSTE_MANUAL_INVALID', details: parsed.error.flatten() }, { status: 400 })
  }

  const value = parsed.data
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id,name,balance,currency')
    .eq('id', value.accountId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (accountError) return NextResponse.json({ error: 'POSTE_ACCOUNT_READ_FAILED' }, { status: 500 })
  if (!account) return NextResponse.json({ error: 'POSTE_ACCOUNT_NOT_FOUND' }, { status: 404 })

  const observedAt = value.observedAt ?? new Date().toISOString()
  const externalKey = `manual:${account.id}`
  const notes = [
    'Valore Poste aggiornato manualmente da documento/schermata.',
    value.notes || null,
  ].filter(Boolean).join(' ')

  const { data: asset, error: upsertError } = await supabase
    .from('external_assets')
    .upsert({
      user_id: user.id,
      name: value.productName,
      provider: 'Poste Italiane',
      asset_type: 'investment',
      instrument: value.productName,
      invested_amount: Number(account.balance ?? 0),
      current_value: value.currentValue,
      currency: String(account.currency ?? 'EUR'),
      source_type: 'POSTE',
      external_key: externalKey,
      linked_account_id: String(account.id),
      include_in_net_worth: true,
      notes,
      observed_at: observedAt,
    }, { onConflict: 'user_id,source_type,external_key' })
    .select('id,current_value,linked_account_id')
    .single()

  if (upsertError) {
    console.error('[poste:manual]', upsertError)
    return NextResponse.json({ error: 'POSTE_MANUAL_SAVE_FAILED' }, { status: 500 })
  }

  const { error: snapshotError } = await supabase.from('external_asset_snapshots').insert({
    user_id: user.id,
    asset_id: asset.id,
    current_value: Number(asset.current_value ?? 0),
    linked_account_balance: Number(account.balance ?? 0),
    observed_at: observedAt,
  })
  if (snapshotError) {
    console.error('[poste:manual:snapshot]', snapshotError)
    return NextResponse.json({ error: 'POSTE_MANUAL_SNAPSHOT_FAILED' }, { status: 500 })
  }

  try {
    const patrimonio = await recordConsolidatedPatrimonioSnapshot(supabase, user, observedAt)
    return NextResponse.json({
      ok: true,
      assetId: asset.id,
      accountName: account.name,
      currentValue: value.currentValue,
      patrimonio,
    })
  } catch (error) {
    console.error('[poste:manual:patrimonio]', error)
    return NextResponse.json({ error: 'POSTE_MANUAL_PATRIMONIO_FAILED' }, { status: 500 })
  }
}
