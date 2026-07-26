import { automationContext, automationError, automationJson } from '../_helpers'
import { listAutomationApplications } from '@/lib/automation/service'

export async function GET(request: Request) {
  try {
    const ctx = await automationContext()
    if ('error' in ctx) return ctx.error
    const limit = Number(new URL(request.url).searchParams.get('limit') ?? 50)
    const applications = await listAutomationApplications(ctx.supabase, ctx.user.id, limit)
    return automationJson({ applications })
  } catch (error) {
    return automationError(error)
  }
}
