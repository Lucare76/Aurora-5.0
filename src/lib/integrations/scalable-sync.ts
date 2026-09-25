import type { SupabaseClient, User } from '@supabase/supabase-js'
import { assetNetWorthContribution, resolveAssetLinkedAccount, resolveScalableLinkedAccount } from '@/lib/patrimonio/linked-assets'
import { personalNetWorthFromAccounts } from '@/lib/patrimonio/personal-net-worth'
import {
  decryptSecret,
  encryptSecret,
  readScalablePortfolio,
  refreshScalableToken,
} from '@/lib/integrations/scalable'

function expiresSoon(value: string | null) {
  if (!value) return false
  return new Date(value).getTime() <= Date.now() + 60_000
}

export type ScalableSyncResult = {
  ok: true
  holdings: number
  savingsPlans: number
  portfolioIds: string[]
  diagnostics?: unknown
}

export async function syncScalableForUser(
  supabase: SupabaseClient,
  user: User,
): Promise<ScalableSyncResult> {
  const { data: connection, error: connectionError } = await supabase
    .from('scalable_connections')
    .select('client_id,access_token_enc,refresh_token_enc,expires_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (connectionError) throw new Error('SCALABLE_CONNECTION_READ_FAILED')
  if (!connection) throw new Error('SCALABLE_NOT_CONNECTED')

  let accessToken = decryptSecret(connection.access_token_enc)
  let nextRefreshEncrypted = connection.refresh_token_enc as string | null
  let nextExpiresAt = connection.expires_at as string | null

  if (expiresSoon(connection.expires_at)) {
    if (!connection.refresh_token_enc) throw new Error('SCALABLE_RECONNECT_REQUIRED')
    const refreshed = await refreshScalableToken({
      clientId: connection.client_id,
      refreshToken: decryptSecret(connection.refresh_token_enc),
    })
    accessToken = refreshed.access_token
    nextRefreshEncrypted = refreshed.refresh_token ? encryptSecret(refreshed.refresh_token) : connection.refresh_token_enc
    nextExpiresAt = refreshed.expires_in
      ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
      : connection.expires_at

    const { error: tokenUpdateError } = await supabase
      .from('scalable_connections')
      .update({
        access_token_enc: encryptSecret(accessToken),
        refresh_token_enc: nextRefreshEncrypted,
        expires_at: nextExpiresAt,
        scope: refreshed.scope ?? null,
        token_type: refreshed.token_type ?? 'Bearer',
        last_error: null,
      })
      .eq('user_id', user.id)
    if (tokenUpdateError) throw tokenUpdateError
  }

  const portfolio = await readScalablePortfolio(accessToken)

  const [existingRes, accountsRes, linksRes] = await Promise.all([
    supabase
      .from('external_assets')
      .select('external_key,invested_amount')
      .eq('user_id', user.id)
      .eq('source_type', 'SCALABLE'),
    supabase
      .from('accounts')
      .select('id,name,balance,is_active')
      .eq('user_id', user.id),
    supabase
      .from('account_purpose_links')
      .select('account_id,purpose')
      .eq('user_id', user.id),
  ])

  if (existingRes.error) throw existingRes.error
  if (accountsRes.error) throw accountsRes.error
  if (linksRes.error) throw linksRes.error

  const existingRows = existingRes.data ?? []
  const accounts = (accountsRes.data ?? []).map((account) => ({
    id: String(account.id),
    name: String(account.name),
    balance: Number(account.balance ?? 0),
  }))
  const accountById = new Map(accounts.map((account) => [account.id, account]))
  const existingInvested = new Map(
    existingRows.map((row) => [String(row.external_key), Number(row.invested_amount ?? 0)]),
  )

  const planByKey = new Map<string, { amount: number | null; nextExecutionDate: string | null }>()
  for (const plan of portfolio.savingsPlans) {
    if (!plan.isin) continue
    planByKey.set(`${plan.portfolioId}:${plan.isin}`, {
      amount: plan.amount,
      nextExecutionDate: plan.nextExecutionDate,
    })
  }

  const observedAt = new Date().toISOString()
  const rows = portfolio.holdings.map((holding) => {
    const existingAmount = existingInvested.get(holding.externalKey)
    const investedAmount = holding.investedAmount != null
      ? Math.max(0, holding.investedAmount)
      : (existingAmount ?? Math.max(0, holding.currentValue))
    const plan = planByKey.get(holding.externalKey)
    const linkedAccount = resolveScalableLinkedAccount(holding.name, accounts)
    const notes = [
      holding.investedAmount == null && existingAmount == null ? 'Capitale versato inizializzato al valore attuale: verifica una volta il dato.' : null,
      linkedAccount ? `Collegato al conto Aurora: ${linkedAccount.name}` : null,
      plan?.amount != null
        ? `PAC Scalable: ${plan.amount} ${holding.currency || 'EUR'}${plan.nextExecutionDate ? ` · prossima esecuzione ${plan.nextExecutionDate}` : ''}`
        : null,
    ].filter(Boolean).join(' · ') || null

    return {
      user_id: user.id,
      name: holding.name,
      provider: 'Scalable Capital',
      asset_type: 'investment',
      instrument: holding.name,
      invested_amount: investedAmount,
      current_value: Math.max(0, holding.currentValue),
      currency: holding.currency || 'EUR',
      source_type: 'SCALABLE',
      external_key: holding.externalKey,
      linked_account_id: linkedAccount?.id ?? null,
      include_in_net_worth: true,
      notes,
      observed_at: observedAt,
    }
  })

  let syncedAssets: Array<{
    id: string
    external_key: string | null
    current_value: number | string
    linked_account_id: string | null
  }> = []

  if (rows.length > 0) {
    const { data: upserted, error: upsertError } = await supabase
      .from('external_assets')
      .upsert(rows, { onConflict: 'user_id,source_type,external_key' })
      .select('id,external_key,current_value,linked_account_id')
    if (upsertError) throw upsertError
    syncedAssets = (upserted ?? []).map((asset) => ({
      id: String(asset.id),
      external_key: asset.external_key ? String(asset.external_key) : null,
      current_value: asset.current_value,
      linked_account_id: asset.linked_account_id ? String(asset.linked_account_id) : null,
    }))

    const snapshots = syncedAssets.map((asset) => ({
      user_id: user.id,
      asset_id: asset.id,
      current_value: Number(asset.current_value ?? 0),
      linked_account_balance: asset.linked_account_id
        ? accountById.get(asset.linked_account_id)?.balance ?? null
        : null,
      observed_at: observedAt,
    }))
    if (snapshots.length > 0) {
      const { error: snapshotError } = await supabase.from('external_asset_snapshots').insert(snapshots)
      if (snapshotError) throw snapshotError
    }
  }

  const activeKeys = new Set(rows.map((row) => row.external_key))
  const staleKeys = existingRows
    .map((row) => String(row.external_key ?? ''))
    .filter((key) => key && !activeKeys.has(key))

  if (staleKeys.length > 0) {
    const { error: staleError } = await supabase
      .from('external_assets')
      .update({
        include_in_net_worth: false,
        notes: 'Posizione non più restituita da Scalable nell’ultima sincronizzazione.',
        observed_at: observedAt,
      })
      .eq('user_id', user.id)
      .eq('source_type', 'SCALABLE')
      .in('external_key', staleKeys)
    if (staleError) throw staleError
  }

  const { data: allAssets, error: allAssetsError } = await supabase
    .from('external_assets')
    .select('id,name,source_type,current_value,include_in_net_worth,linked_account_id')
    .eq('user_id', user.id)
  if (allAssetsError) throw allAssetsError

  const netWorthAdjustment = (allAssets ?? []).reduce((sum, asset) => {
    const linked = resolveAssetLinkedAccount(asset, accounts)
    return sum + assetNetWorthContribution({
      id: String(asset.id),
      name: String(asset.name),
      current_value: asset.current_value,
      include_in_net_worth: Boolean(asset.include_in_net_worth),
      linked_account_id: linked?.id ?? asset.linked_account_id,
    }, linked?.balance ?? null)
  }, 0)

  const baseNetWorth = personalNetWorthFromAccounts(accountsRes.data ?? [], linksRes.data ?? [])
  const { error: patrimonioSnapshotError } = await supabase.from('patrimonio_snapshots').insert({
    user_id: user.id,
    base_net_worth: baseNetWorth,
    net_worth_adjustment: netWorthAdjustment,
    consolidated_value: baseNetWorth + netWorthAdjustment,
    observed_at: observedAt,
  })
  if (patrimonioSnapshotError) throw patrimonioSnapshotError

  const zeroHoldings = portfolio.holdings.length === 0
  const { error: connectionUpdateError } = await supabase
    .from('scalable_connections')
    .update({
      last_synced_at: observedAt,
      last_error: zeroHoldings ? 'NO_HOLDINGS_PARSED' : null,
      metadata: {
        portfolio_ids: portfolio.portfolioIds,
        available_tools: portfolio.availableTools,
        holdings_count: portfolio.holdings.length,
        savings_plans_count: portfolio.savingsPlans.length,
        diagnostics: zeroHoldings ? portfolio.diagnostics : undefined,
      },
    })
    .eq('user_id', user.id)
  if (connectionUpdateError) throw connectionUpdateError

  return {
    ok: true,
    holdings: portfolio.holdings.length,
    savingsPlans: portfolio.savingsPlans.length,
    portfolioIds: portfolio.portfolioIds,
    diagnostics: zeroHoldings ? portfolio.diagnostics : undefined,
  }
}

export async function recordScalableSyncError(
  supabase: SupabaseClient,
  userId: string,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR'
  await supabase
    .from('scalable_connections')
    .update({ last_error: message.slice(0, 500) })
    .eq('user_id', userId)
  return message
}
