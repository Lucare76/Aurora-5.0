import { notFound } from 'next/navigation'
import { canAccessPrivateFinance } from '@/lib/access/private-finance-access'
import { createClient } from '@/lib/supabase/server'
import { AdiPageClient } from './AdiPageClient'

export const dynamic = 'force-dynamic'

export default async function AdiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !canAccessPrivateFinance(user.email)) notFound()

  return <AdiPageClient />
}
