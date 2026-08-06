import { canAccessPrivateFinance } from '@/lib/access/private-finance-access'
import { createClient } from '@/lib/supabase/server'
import { AppLayoutClient } from '@/components/app-layout-client'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const canAccessPrivateFinanceForUser = canAccessPrivateFinance(user?.email)

  return <AppLayoutClient canAccessPrivateFinance={canAccessPrivateFinanceForUser}>{children}</AppLayoutClient>
}
