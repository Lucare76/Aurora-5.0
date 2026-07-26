import { automationContext, automationError, automationJson } from '../../_helpers'
import { deleteAutomationRule, getAutomationRule, updateAutomationRule } from '@/lib/automation/service'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const ctx = await automationContext()
    if ('error' in ctx) return ctx.error
    const { id } = await params
    const rule = await getAutomationRule(ctx.supabase, ctx.user.id, id)
    return automationJson({ rule })
  } catch (error) {
    return automationError(error)
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const ctx = await automationContext()
    if ('error' in ctx) return ctx.error
    const { id } = await params
    const rule = await updateAutomationRule(ctx.supabase, ctx.user.id, id, await request.json())
    return automationJson({ rule })
  } catch (error) {
    return automationError(error, 'INVALID_RULE')
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const ctx = await automationContext()
    if ('error' in ctx) return ctx.error
    const { id } = await params
    await deleteAutomationRule(ctx.supabase, ctx.user.id, id)
    return automationJson({ success: true })
  } catch (error) {
    return automationError(error)
  }
}
