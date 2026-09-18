import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parsePosteBuoniWorkbook, resolvePosteAccount } from '@/lib/integrations/poste'
import { recordConsolidatedPatrimonioSnapshot } from '@/lib/patrimonio/record-consolidated-snapshot'

const MAX_FILE_BYTES = 5 * 1024 * 1024

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'POSTE_FILE_REQUIRED' }, { status: 400 })
  }
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'POSTE_FILE_SIZE_INVALID' }, { status: 400 })
  }

  const lowerName = file.name.toLocaleLowerCase('it-IT')
  if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
    return NextResponse.json({ error: 'POSTE_FILE_FORMAT_UNSUPPORTED' }, { status: 400 })
  }

  try {
    const imported = parsePosteBuoniWorkbook(await file.arrayBuffer())

    const { data: accountRows, error: accountsError } = await supabase
      .from('accounts')
      .select('id,name,balance')
      .eq('user_id', user.id)
      .eq('is_active', true)
    if (accountsError) throw accountsError

    const accounts = (accountRows ?? []).map((account) => ({
      id: String(account.id),
      name: String(account.name),
      balance: Number(account.balance ?? 0),
    }))

    const resolved = imported.map((asset) => ({
      asset,
      account: resolvePosteAccount(asset.accountName, accounts),
    }))

    const missingAccounts = [...new Set(
      resolved.filter((item) => !item.account).map((item) => item.asset.accountName),
    )]
    if (missingAccounts.length > 0) {
      return NextResponse.json(
        { error: 'POSTE_ACCOUNT_MAPPING_MISSING', missingAccounts },
        { status: 409 },
      )
    }

    const observedAt = new Date().toISOString()
    const rows = resolved.map(({ asset, account }) => ({
      user_id: user.id,
      name: asset.name,
      provider: 'Poste Italiane',
      asset_type: 'investment',
      instrument: asset.instrument,
      invested_amount: asset.investedAmount,
      current_value: asset.currentValue,
      currency: 'EUR',
      source_type: 'POSTE',
      external_key: asset.externalKey,
      linked_account_id: account!.id,
      include_in_net_worth: true,
      notes: asset.notes,
      observed_at: observedAt,
    }))

    const { data: upserted, error: upsertError } = await supabase
      .from('external_assets')
      .upsert(rows, { onConflict: 'user_id,source_type,external_key' })
      .select('id,name,current_value,linked_account_id')
    if (upsertError) throw upsertError

    const accountById = new Map(accounts.map((account) => [account.id, account]))
    const snapshots = (upserted ?? []).map((asset) => ({
      user_id: user.id,
      asset_id: String(asset.id),
      current_value: Number(asset.current_value ?? 0),
      linked_account_balance: asset.linked_account_id
        ? accountById.get(String(asset.linked_account_id))?.balance ?? null
        : null,
      observed_at: observedAt,
    }))

    if (snapshots.length > 0) {
      const { error: snapshotError } = await supabase
        .from('external_asset_snapshots')
        .insert(snapshots)
      if (snapshotError) throw snapshotError
    }

    const patrimonio = await recordConsolidatedPatrimonioSnapshot(supabase, user, observedAt)

    return NextResponse.json({
      ok: true,
      imported: rows.length,
      products: rows.map((row) => ({
        name: row.name,
        nominalValue: Number(row.invested_amount),
        currentValue: Number(row.current_value),
        linkedAccountId: row.linked_account_id,
      })),
      patrimonio,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    console.error('[poste:import]', error)

    if (message === 'POSTE_WORKBOOK_EMPTY' || message === 'POSTE_NO_SUPPORTED_ROWS') {
      return NextResponse.json({ error: message }, { status: 422 })
    }
    return NextResponse.json({ error: 'POSTE_IMPORT_FAILED' }, { status: 500 })
  }
}
