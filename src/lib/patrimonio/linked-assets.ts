export type LinkedAccount = {
  id: string
  name: string
  balance: number
}

export type PatrimonioAssetLike = {
  id: string
  name: string
  instrument?: string | null
  current_value: number | string
  include_in_net_worth: boolean
  linked_account_id?: string | null
}

export type AssetSnapshotLike = {
  asset_id: string
  current_value: number | string
  observed_at: string
}

const SCALABLE_ACCOUNT_RULES = [
  { needle: 'ishares core msci world', accountName: 'Aurora Piano di Accumulo' },
  { needle: 'vanguard ftse all-world', accountName: 'Scalable' },
] as const

function normalize(value: string | null | undefined) {
  return (value ?? '').trim().toLocaleLowerCase('it-IT')
}

export function resolveScalableLinkedAccount(
  holdingName: string,
  accounts: LinkedAccount[],
): LinkedAccount | null {
  const normalizedHolding = normalize(holdingName)
  const rule = SCALABLE_ACCOUNT_RULES.find((candidate) => normalizedHolding.includes(candidate.needle))
  if (!rule) return null

  const target = normalize(rule.accountName)
  return accounts.find((account) => normalize(account.name) === target) ?? null
}

export function assetNetWorthContribution(
  asset: PatrimonioAssetLike,
  linkedAccountBalance: number | null,
) {
  if (!asset.include_in_net_worth) return 0
  const current = Number(asset.current_value || 0)
  if (asset.linked_account_id && linkedAccountBalance != null) {
    return current - linkedAccountBalance
  }
  return current
}

export function historicalChange(
  currentValue: number,
  snapshots: AssetSnapshotLike[],
  daysAgo: number,
  now = new Date(),
): number | null {
  const target = now.getTime() - daysAgo * 86_400_000
  const candidate = snapshots
    .filter((snapshot) => new Date(snapshot.observed_at).getTime() <= target)
    .sort((a, b) => new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime())[0]

  if (!candidate) return null
  return currentValue - Number(candidate.current_value || 0)
}

export function formatLinkedAccountRule(holdingName: string) {
  const normalizedHolding = normalize(holdingName)
  return SCALABLE_ACCOUNT_RULES.find((candidate) => normalizedHolding.includes(candidate.needle))?.accountName ?? null
}
