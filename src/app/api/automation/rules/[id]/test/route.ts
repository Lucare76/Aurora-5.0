import { automationContext, automationError, automationJson } from '../../../_helpers'
import { getAutomationRule, loadAutomationReferences } from '@/lib/automation/service'
import { matchesRule } from '@/lib/automation/engine'
import { testRuleSchema } from '@/lib/automation/validators'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const ctx = await automationContext()
    if ('error' in ctx) return ctx.error
    const { id } = await params
    const draft = testRuleSchema.parse(await request.json())
    const [rule, references] = await Promise.all([
      getAutomationRule(ctx.supabase, ctx.user.id, id),
      loadAutomationReferences(ctx.supabase, ctx.user.id),
    ])
    const evaluation = matchesRule(rule, {
      ...draft,
      id: 'test',
      user_id: ctx.user.id,
      description: draft.description ?? null,
      category_id: draft.category_id ?? null,
      notes: draft.notes ?? null,
      transfer_peer_id: draft.transfer_peer_id ?? null,
      created_at: '',
      updated_at: '',
    }, references)
    return automationJson({ evaluation, saved: false })
  } catch (error) {
    return automationError(error, 'AUTOMATION_FAILED')
  }
}
