import { automationContext, automationError, automationJson } from '../_helpers'
import { createAutomationRule, listAutomationApplications, listAutomationRules } from '@/lib/automation/service'

export async function GET() {
  try {
    const ctx = await automationContext()
    if ('error' in ctx) return ctx.error
    const [rules, applications] = await Promise.all([
      listAutomationRules(ctx.supabase, ctx.user.id),
      listAutomationApplications(ctx.supabase, ctx.user.id, 30),
    ])
    return automationJson({ rules, applications })
  } catch (error) {
    return automationError(error)
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await automationContext()
    if ('error' in ctx) return ctx.error
    const rule = await createAutomationRule(ctx.supabase, ctx.user.id, await request.json())
    return automationJson({ rule }, 201)
  } catch (error) {
    return automationError(error, 'INVALID_RULE')
  }
}
