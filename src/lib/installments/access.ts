import type { SupabaseClient } from '@supabase/supabase-js'
import { canAccessPrivateFinance } from '@/lib/access/private-finance-access'

export async function allowedInstallmentAccount(supabase: SupabaseClient, user: { id: string; email?: string | null }, accountId: string) {
  if (canAccessPrivateFinance(user.email)) return true
  const { data, error } = await supabase.from('account_purpose_links').select('purpose').eq('user_id', user.id).eq('account_id', accountId)
  return !error && !(data ?? []).some((row) => ['DEPENDENT_AURORA', 'DEPENDENT', 'ADI'].includes(row.purpose ?? ''))
}
