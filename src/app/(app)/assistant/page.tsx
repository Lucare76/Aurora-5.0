import { notFound } from 'next/navigation'
import { isFinancialAssistantEnabled } from '@/lib/financial-assistant/scope-policy'
import { AssistantClient } from './AssistantClient'

export const dynamic = 'force-dynamic'

export default function AssistantPage() {
  if (!isFinancialAssistantEnabled()) notFound()
  return <AssistantClient />
}
