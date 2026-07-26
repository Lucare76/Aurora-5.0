import { automationContext, automationError, automationJson } from '../../../_helpers'
import { previewAutomationRule } from '@/lib/automation/service'
import { previewRequestSchema } from '@/lib/automation/validators'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const ctx = await automationContext()
    if ('error' in ctx) return ctx.error
    const { id } = await params
    const body = previewRequestSchema.parse(await request.json().catch(() => ({})))
    const rows = await previewAutomationRule(ctx.supabase, ctx.user.id, id, body)
    return automationJson({ rows, total: rows.length, message: 'Questa è soltanto un’anteprima.' })
  } catch (error) {
    return automationError(error, 'PREVIEW_FAILED')
  }
}
