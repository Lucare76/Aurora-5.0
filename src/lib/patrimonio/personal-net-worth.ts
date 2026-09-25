import { filterPersonalAccounts } from '@/lib/dependent-finance/calculations'

type Account = { id: string; balance: number | string; is_active: boolean }
type PurposeLink = { account_id: string; purpose: string | null }

// Admin clients bypass RLS. Always scope the database queries by user_id before
// passing rows here; the calculation then applies the same PERSONAL perimeter
// as the dashboard and excludes inactive accounts.
export function personalNetWorthFromAccounts(accounts: Account[], links: PurposeLink[]) {
  const active = accounts.filter((account) => account.is_active)
  return Math.round(filterPersonalAccounts(active, links)
    .reduce((sum, account) => sum + Number(account.balance ?? 0), 0) * 100) / 100
}
