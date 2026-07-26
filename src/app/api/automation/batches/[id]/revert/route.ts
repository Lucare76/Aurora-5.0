import { automationContext, automationError, automationJson } from '../../../_helpers'
import { revertAutomationBatch } from '@/lib/automation/service'

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  try {
    const ctx = await automationContext()
    if ('error' in ctx) return ctx.error
    const { id } = await params
    const batch = await revertAutomationBatch(ctx.supabase, ctx.user.id, id)
    return automationJson({ batch })
  } catch (error) {
    return automationError(error, 'REVERT_FAILED')
  }
}
