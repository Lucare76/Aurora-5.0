import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato data non valido (YYYY-MM-DD)')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Data non valida')

const amount = z.number().finite().positive()
const uuid = z.string().uuid()
const baseCreateSchema = {
  description: z.string().trim().min(1),
  amount,
  date: isoDate,
  account_id: uuid,
  notes: z.string().nullable().optional(),
  recurring_id: uuid.nullable().optional(),
}

const incomeCreateSchema = z
  .object({
    ...baseCreateSchema,
    type: z.literal('income'),
    category_id: uuid.nullable().optional(),
  })
  .strict()

const expenseCreateSchema = z
  .object({
    ...baseCreateSchema,
    type: z.literal('expense'),
    category_id: uuid.nullable().optional(),
  })
  .strict()

const transferCreateSchema = z
  .object({
    ...baseCreateSchema,
    type: z.literal('transfer'),
    destination_account_id: uuid,
  })
  .strict()
  .refine((data) => data.account_id !== data.destination_account_id, {
    message: 'Il conto di destinazione deve essere diverso dal conto di origine',
    path: ['destination_account_id'],
  })

const createSchema = z.discriminatedUnion('type', [
  incomeCreateSchema,
  expenseCreateSchema,
  transferCreateSchema,
])

const updateSchema = z.object({
  transaction_id: z.string().uuid(),
  account_id: z.string().uuid().optional(),
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  amount: amount.optional(),
  date: isoDate.optional(),
  description: z.string().trim().min(1).optional(),
  category_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  destination_account_id: z.string().uuid().nullable().optional(),
  clear_category: z.boolean().optional(),
}).strict().refine(
  (data) => !data.account_id || !data.destination_account_id || data.account_id !== data.destination_account_id,
  {
    message: 'Il conto di destinazione deve essere diverso dal conto di origine',
    path: ['destination_account_id'],
  },
)

const deleteSchema = z.object({
  transaction_id: z.string().uuid(),
}).strict()

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
  return isSafe ? pgMessage : fallback
}

function errorStatus(msg: string): number {
  if (msg.includes('not found') || msg.includes('not owned')) return 403
  if (
    msg.includes('required') ||
    msg.includes('must differ') ||
    msg.includes('Invalid transaction type') ||
    msg.includes('Amount must be positive')
  ) return 400
  if (msg.toLowerCase().includes('constraint') || msg.toLowerCase().includes('violates')) return 409
  return 500
}

function validationError(error: z.ZodError) {
  return NextResponse.json(
    { error: 'Dati non validi', code: 'VALIDATION_ERROR', details: error.flatten() },
    { status: 400 },
  )
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
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

    const body = await readJson(request)
    const parsed = createSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed.error)
    }

    const d = parsed.data
    const categoryId = d.type === 'transfer' ? null : d.category_id ?? null
    const destinationAccountId = d.type === 'transfer' ? d.destination_account_id : null

    const { data, error } = await supabase.rpc('create_transaction_atomic', {
      p_account_id: d.account_id,
      p_type: d.type,
      p_amount: d.amount,
      p_date: d.date,
      p_description: d.description,
      p_category_id: categoryId,
      p_notes: d.notes ?? null,
      p_destination_account_id: destinationAccountId,
      p_recurring_id: d.recurring_id ?? null,
    })

    if (error) {
      const msg = sanitizeError(error.message, 'Errore nella creazione della transazione')
      return NextResponse.json({ error: msg }, { status: errorStatus(error.message ?? msg) })
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

    const body = await readJson(request)
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed.error)
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
      return NextResponse.json({ error: msg }, { status: errorStatus(error.message ?? msg) })
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

    const body = await readJson(request)
    const parsed = deleteSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed.error)
    }

    const { error } = await supabase.rpc('delete_transaction_atomic', {
      p_transaction_id: parsed.data.transaction_id,
    })

    if (error) {
      const msg = sanitizeError(error.message, 'Errore nella cancellazione della transazione')
      return NextResponse.json({ error: msg }, { status: errorStatus(error.message ?? msg) })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
