import { notFound } from 'next/navigation'
import { canAccessPrivateFinance } from '@/lib/access/private-finance-access'
import { createClient } from '@/lib/supabase/server'
import { AuroraSavingsPageClient } from './AuroraPageClient'

export const dynamic = 'force-dynamic'

export default async function AuroraSavingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !canAccessPrivateFinance(user.email)) notFound()

  return <AuroraSavingsPageClient />
}
