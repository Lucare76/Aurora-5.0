import { notFound } from 'next/navigation'
import { canAccessPrivateHr } from '@/lib/access/private-finance-access'
import { createClient } from '@/lib/supabase/server'
import { TimelinePageClient } from './TimelinePageClient'

export const dynamic = 'force-dynamic'

export default async function TimelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !canAccessPrivateHr(user.email)) notFound()

  return <TimelinePageClient />
}
