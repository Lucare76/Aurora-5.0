import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato data non valido (YYYY-MM-DD)')

const createSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  date: isoDate,
  type: z.enum(['income', 'expense', 'transfer']),
  account_id: z.string().uuid(),
  destination_account_id: z.string().uuid().optional(),
  category_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  recurring_id: z.string().uuid().nullable().optional(),
})

const updateSchema = z.object({
  transaction_id: z.string().uuid(),
  account_id: z.string().uuid().optional(),
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  amount: z.number().positive().optional(),
  date: isoDate.optional(),
  description: z.string().optional(),
  category_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  destination_account_id: z.string().uuid().nullable().optional(),
  clear_category: z.boolean().optional(),
})

const deleteSchema = z.object({
  transaction_id: z.string().uuid(),
})

const SAFE_PG_ERRORS = [
  'Source account not found',
  'Source account not owned by current user',
  'Destination account not found',
  'Destination account not owned by current user',
  'Destination account is required for transfers',
  'Source and destination accounts must differ',
  'Category not found or not owned by current user',
  'Invalid transaction type',
  'Amount must be positive',
  'Transaction not found',
  'Transaction not owned by current user',
  'New source account not found or not owned by current user',
  'New destination account not found or not owned by current user',
]

function sanitizeError(pgMessage: string | undefined, fallback: string): string {
  if (!pgMessage) return fallback
  const isSafe = SAFE_PG_ERRORS.some((e) => pgMessage.includes(e))
  if (!isSafe) console.error('[aurora] RPC error raw:', pgMessage)
  // In dev, return the raw message so it appears in the UI toast.
  if (process.env.NODE_ENV === 'development') return pgMessage
  return isSafe ? pgMessage : fallback
}

function errorStatus(msg: string): number {
  if (msg.includes('not found') || msg.includes('not owned')) return 403
  return 500
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const d = parsed.data

    const { data, error } = await supabase.rpc('create_transaction_atomic', {
      p_account_id: d.account_id,
      p_type: d.type,
      p_amount: d.amount,
      p_date: d.date,
      p_description: d.description,
      p_category_id: d.category_id ?? null,
      p_notes: d.notes ?? null,
      p_destination_account_id: d.destination_account_id ?? null,
      p_recurring_id: d.recurring_id ?? null,
    })

    if (error) {
      const msg = sanitizeError(error.message, 'Errore nella creazione della transazione')
      return NextResponse.json({ error: msg }, { status: errorStatus(msg) })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const d = parsed.data

    const { data, error } = await supabase.rpc('update_transaction_atomic', {
      p_transaction_id: d.transaction_id,
      p_account_id: d.account_id ?? null,
      p_type: d.type ?? null,
      p_amount: d.amount ?? null,
      p_date: d.date ?? null,
      p_description: d.description ?? null,
      p_category_id: d.category_id ?? null,
      p_notes: d.notes ?? null,
      p_destination_account_id: d.destination_account_id ?? null,
      p_clear_category: d.clear_category ?? false,
    })

    if (error) {
      const msg = sanitizeError(error.message, 'Errore nella modifica della transazione')
      return NextResponse.json({ error: msg }, { status: errorStatus(msg) })
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = deleteSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { error } = await supabase.rpc('delete_transaction_atomic', {
      p_transaction_id: parsed.data.transaction_id,
    })

    if (error) {
      const msg = sanitizeError(error.message, 'Errore nella cancellazione della transazione')
      return NextResponse.json({ error: msg }, { status: errorStatus(msg) })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
