import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { DataIntegrityError, getDataIntegrityIssue, updateDataIntegrityIssueStatus } from '@/lib/data-integrity/service'

export const dynamic = 'force-dynamic'

const duplicateRules = new Set(['TRANSACTION_EXACT_DUPLICATE', 'TRANSACTION_POSSIBLE_DUPLICATE'])

const deleteSchema = z.object({
  transaction_id: z.string().uuid(),
}).strict()

type Params = { params: Promise<{ id: string }> }

type DuplicateTransactionRow = {
  id: string
  user_id: string
  account_id: string
  category_id: string | null
  type: 'income' | 'expense' | 'transfer'
  amount: number | string
  description: string | null
  date: string
  transfer_peer_id: string | null
  recurring_id: string | null
  receipt_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

type AccountRow = { id: string; name: string }
type CategoryRow = { id: string; name: string }

export async function GET(_request: Request, context: Params) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return json({ error: 'UNAUTHORIZED' }, 401)

  try {
    const { id } = await context.params
    const issue = await getDataIntegrityIssue(supabase, user.id, id)
    if (!duplicateRules.has(issue.ruleCode)) return json({ error: 'ISSUE_NOT_DUPLICATE' }, 400)

    const movements = await loadDuplicateMovements(supabase, user.id, issue.entityIds)
    return json({ issue, movements }, 200)
  } catch (err) {
    if (err instanceof DataIntegrityError) return json({ error: err.code }, 404)
    return json({ error: 'DUPLICATE_DETAIL_FAILED' }, 500)
  }
}

export async function DELETE(request: Request, context: Params) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return json({ error: 'UNAUTHORIZED' }, 401)

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: 'INVALID_DELETE_REQUEST' }, 400)

  try {
    const { id } = await context.params
    const issue = await getDataIntegrityIssue(supabase, user.id, id)
    if (!duplicateRules.has(issue.ruleCode)) return json({ error: 'ISSUE_NOT_DUPLICATE' }, 400)
    if (issue.status !== 'open') return json({ error: 'ISSUE_NOT_OPEN' }, 409)
    if (!issue.entityIds.includes(parsed.data.transaction_id)) return json({ error: 'TRANSACTION_NOT_IN_ISSUE' }, 400)

    const movements = await loadDuplicateMovements(supabase, user.id, issue.entityIds)
    const target = movements.find((movement) => movement.id === parsed.data.transaction_id)
    if (!target) return json({ error: 'TRANSACTION_NOT_FOUND' }, 404)
    if (target.type === 'transfer' || target.transferPeerId || target.recurringId) {
      return json({ error: 'TRANSACTION_NOT_SAFE_TO_DELETE' }, 409)
    }

    const { error: deleteError } = await supabase.rpc('delete_transaction_atomic', {
      p_transaction_id: parsed.data.transaction_id,
    })
    if (deleteError) return json({ error: 'TRANSACTION_DELETE_FAILED' }, 500)

    const resolvedIssue = await updateDataIntegrityIssueStatus(supabase, user.id, id, 'resolved', null)
    return json({ success: true, issue: resolvedIssue }, 200)
  } catch (err) {
    if (err instanceof DataIntegrityError) return json({ error: err.code }, 404)
    return json({ error: 'DUPLICATE_DELETE_FAILED' }, 500)
  }
}

async function loadDuplicateMovements(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  entityIds: string[],
) {
  const ids = entityIds.slice(0, 10)
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('id,user_id,account_id,category_id,type,amount,description,date,transfer_peer_id,recurring_id,receipt_data,created_at,updated_at')
    .eq('user_id', userId)
    .in('id', ids)

  if (error) throw new Error('TRANSACTIONS_FETCH_FAILED')
  const rows = (transactions ?? []) as DuplicateTransactionRow[]
  const accountIds = [...new Set(rows.map((row) => row.account_id).filter(Boolean))]
  const categoryIds = [...new Set(rows.map((row) => row.category_id).filter(Boolean) as string[])]

  const [{ data: accounts }, { data: categories }] = await Promise.all([
    supabase.from('accounts').select('id,name').eq('user_id', userId).in('id', accountIds.length ? accountIds : ['00000000-0000-0000-0000-000000000000']),
    supabase.from('categories').select('id,name').eq('user_id', userId).in('id', categoryIds.length ? categoryIds : ['00000000-0000-0000-0000-000000000000']),
  ])

  const accountById = new Map(((accounts ?? []) as AccountRow[]).map((account) => [account.id, account.name]))
  const categoryById = new Map(((categories ?? []) as CategoryRow[]).map((category) => [category.id, category.name]))

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    description: row.description ?? '',
    amount: Number(row.amount) || 0,
    type: row.type,
    accountId: row.account_id,
    accountName: accountById.get(row.account_id) ?? 'Conto non trovato',
    categoryId: row.category_id,
    categoryName: row.category_id ? categoryById.get(row.category_id) ?? 'Categoria non trovata' : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    recurringId: row.recurring_id,
    transferPeerId: row.transfer_peer_id,
    sourceFingerprint: transactionSourceFingerprint(row.receipt_data),
  }))
}

function transactionSourceFingerprint(receiptData: Record<string, unknown> | null): string | null {
  if (!receiptData) return null
  const keys = ['external_transaction_id', 'externalTransactionId', 'transaction_id', 'transactionId', 'import_fingerprint', 'importFingerprint', 'source_id', 'sourceId', 'fingerprint', 'idempotency_key']
  for (const key of keys) {
    const value = receiptData[key]
    if (typeof value === 'string' || typeof value === 'number') {
      const normalized = String(value).trim()
      if (normalized) return normalized.slice(0, 24)
    }
  }
  return null
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
