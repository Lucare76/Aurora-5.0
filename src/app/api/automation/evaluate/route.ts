import { automationContext, automationError, automationJson } from '../_helpers'
import { evaluateTransactionDraft } from '@/lib/automation/service'
import { testRuleSchema } from '@/lib/automation/validators'

export async function POST(request: Request) {
  try {
    const ctx = await automationContext()
    if ('error' in ctx) return ctx.error
    const draft = testRuleSchema.parse(await request.json())
    const result = await evaluateTransactionDraft(ctx.supabase, ctx.user.id, {
      ...draft,
      description: draft.description ?? null,
      category_id: draft.category_id ?? null,
      notes: draft.notes ?? null,
      transfer_peer_id: draft.transfer_peer_id ?? null,
    })
    return automationJson({ result, saved: false })
  } catch (error) {
    return automationError(error)
  }
}
