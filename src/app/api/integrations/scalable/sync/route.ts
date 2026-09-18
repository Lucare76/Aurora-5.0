import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { data: connection, error: connectionError } = await supabase
    .from('scalable_connections')
    .select('client_id,access_token_enc,refresh_token_enc,expires_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (connectionError) return NextResponse.json({ error: 'SCALABLE_CONNECTION_READ_FAILED' }, { status: 500 })
  if (!connection) return NextResponse.json({ error: 'SCALABLE_NOT_CONNECTED' }, { status: 409 })

  try {
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

      await supabase
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
    }

    const portfolio = await readScalablePortfolio(accessToken)

    const { data: existingRows, error: existingError } = await supabase
      .from('external_assets')
      .select('external_key,invested_amount')
      .eq('user_id', user.id)
      .eq('source_type', 'SCALABLE')

    if (existingError) throw existingError
    const existingInvested = new Map(
      (existingRows ?? []).map((row) => [String(row.external_key), Number(row.invested_amount ?? 0)]),
    )

    const planByKey = new Map<string, { amount: number | null; nextExecutionDate: string | null }>()
    for (const plan of portfolio.savingsPlans) {
      if (!plan.isin) continue
      planByKey.set(`${plan.portfolioId}:${plan.isin}`, {
        amount: plan.amount,
        nextExecutionDate: plan.nextExecutionDate,
      })
    }

    const rows = portfolio.holdings.map((holding) => {
      const existingAmount = existingInvested.get(holding.externalKey)
      const investedAmount = holding.investedAmount != null
        ? Math.max(0, holding.investedAmount)
        : (existingAmount ?? Math.max(0, holding.currentValue))
      const plan = planByKey.get(holding.externalKey)
      const notes = [
        holding.investedAmount == null && existingAmount == null ? 'Capitale versato inizializzato al valore attuale: verifica una volta il dato.' : null,
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
        include_in_net_worth: true,
        notes,
        observed_at: new Date().toISOString(),
      }
    })

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('external_assets')
        .upsert(rows, { onConflict: 'user_id,source_type,external_key' })
      if (upsertError) throw upsertError
    }

    const activeKeys = new Set(rows.map((row) => row.external_key))
    const staleKeys = (existingRows ?? [])
      .map((row) => String(row.external_key ?? ''))
      .filter((key) => key && !activeKeys.has(key))

    if (staleKeys.length > 0) {
      const { error: staleError } = await supabase
        .from('external_assets')
        .update({
          include_in_net_worth: false,
          notes: 'Posizione non più restituita da Scalable nell’ultima sincronizzazione.',
          observed_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('source_type', 'SCALABLE')
        .in('external_key', staleKeys)
      if (staleError) throw staleError
    }

    const zeroHoldings = portfolio.holdings.length === 0

    await supabase
      .from('scalable_connections')
      .update({
        last_synced_at: new Date().toISOString(),
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

    return NextResponse.json({
      ok: true,
      holdings: portfolio.holdings.length,
      savingsPlans: portfolio.savingsPlans.length,
      portfolioIds: portfolio.portfolioIds,
      diagnostics: zeroHoldings ? portfolio.diagnostics : undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    console.error('[scalable:sync]', error)
    await supabase
      .from('scalable_connections')
      .update({ last_error: message.slice(0, 500) })
      .eq('user_id', user.id)

    const reconnect = message.includes('RECONNECT') || message.includes('401') || message.includes('invalid_grant')
    return NextResponse.json(
      { error: reconnect ? 'SCALABLE_RECONNECT_REQUIRED' : 'SCALABLE_SYNC_FAILED', detail: message },
      { status: reconnect ? 401 : 502 },
    )
  }
}
