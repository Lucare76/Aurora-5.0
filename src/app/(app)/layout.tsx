import { canAccessPrivateFinance, canAccessPrivateHr } from '@/lib/access/private-finance-access'
import { isFinancialAssistantEnabled } from '@/lib/financial-assistant/scope-policy'
import { createClient } from '@/lib/supabase/server'
import { AppLayoutClient } from '@/components/app-layout-client'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const canAccessPrivateFinanceForUser = canAccessPrivateFinance(user?.email)
  const canAccessPrivateHrForUser = canAccessPrivateHr(user?.email)
  const financialAssistantEnabled = isFinancialAssistantEnabled()

  return (
    <AppLayoutClient
      canAccessPrivateFinance={canAccessPrivateFinanceForUser}
      canAccessPrivateHr={canAccessPrivateHrForUser}
      financialAssistantEnabled={financialAssistantEnabled}
    >
      {children}
    </AppLayoutClient>
  )
}
