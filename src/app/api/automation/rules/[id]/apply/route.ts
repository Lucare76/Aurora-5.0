import { automationContext, automationError, automationJson } from '../../../_helpers'
import { applyAutomationRuleBulk } from '@/lib/automation/service'
import { applyRuleSchema } from '@/lib/automation/validators'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const ctx = await automationContext()
    if ('error' in ctx) return ctx.error
    const { id } = await params
    const body = applyRuleSchema.parse(await request.json())
    const batch = await applyAutomationRuleBulk(ctx.supabase, ctx.user.id, id, body)
    return automationJson({ batch })
  } catch (error) {
    return automationError(error, 'AUTOMATION_FAILED')
  }
}
