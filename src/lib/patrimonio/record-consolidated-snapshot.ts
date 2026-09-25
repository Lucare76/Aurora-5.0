import type { SupabaseClient, User } from '@supabase/supabase-js'
import { assetNetWorthContribution, resolveAssetLinkedAccount } from '@/lib/patrimonio/linked-assets'
import { personalNetWorthFromAccounts } from '@/lib/patrimonio/personal-net-worth'

export async function recordConsolidatedPatrimonioSnapshot(
  supabase: SupabaseClient,
  user: User,
  observedAt = new Date().toISOString(),
) {
  const [accountsRes, assetsRes, linksRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('id,name,balance,is_active')
      .eq('user_id', user.id),
    supabase
      .from('external_assets')
      .select('id,name,source_type,current_value,include_in_net_worth,linked_account_id')
      .eq('user_id', user.id),
    supabase
      .from('account_purpose_links')
      .select('account_id,purpose')
      .eq('user_id', user.id),
  ])

  if (accountsRes.error) throw accountsRes.error
  if (assetsRes.error) throw assetsRes.error
  if (linksRes.error) throw linksRes.error

  const accounts = (accountsRes.data ?? []).map((account) => ({
    id: String(account.id), name: String(account.name), balance: Number(account.balance ?? 0),
  }))

  const netWorthAdjustment = (assetsRes.data ?? []).reduce((sum, asset) => {
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
  const consolidatedValue = baseNetWorth + netWorthAdjustment

  const { error } = await supabase.from('patrimonio_snapshots').insert({
    user_id: user.id,
    base_net_worth: baseNetWorth,
    net_worth_adjustment: netWorthAdjustment,
    consolidated_value: consolidatedValue,
    observed_at: observedAt,
  })
  if (error) throw error

  return { baseNetWorth, netWorthAdjustment, consolidatedValue }
}
