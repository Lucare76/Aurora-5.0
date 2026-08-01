import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { ADI_CATEGORIES } from '@/lib/dependent-finance/constants'
import { buildAdiSummary, canRegisterAdiDebit } from '@/lib/dependent-finance/calculations'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Data non valida')

const money = z.number().finite().positive()
const period = z.string().regex(/^\d{4}-\d{2}$/).nullable().optional()

const createSchema = z.discriminatedUnion('entryType', [
  z.object({
    entryType: z.literal('credit'),
    amount: money,
    date: isoDate,
    referencePeriod: period,
    description: z.string().trim().min(1).max(500),
    note: z.string().trim().max(5000).nullable().optional(),
  }).strict(),
  z.object({
    entryType: z.literal('debit'),
    amount: money,
    date: isoDate,
    adiCategory: z.enum(ADI_CATEGORIES),
    description: z.string().trim().min(1).max(500),
    note: z.string().trim().max(5000).nullable().optional(),
    transactionId: z.string().uuid().nullable().optional(),
    paidWithAdi: z.literal(true),
  }).strict(),
])

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function readEntries(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase
    .from('adi_entries')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'Non autenticato' }, 401)

  const url = new URL(request.url)
  const month = url.searchParams.get('month')
  const category = url.searchParams.get('category')

  try {
    const entries = await readEntries(supabase, user.id)
    const filtered = entries
      .filter((entry) => !month || entry.date.startsWith(month))
      .filter((entry) => !category || entry.adi_category === category)

    return json({
      data: {
        entries: filtered,
        allEntries: entries,
        summary: buildAdiSummary(entries),
        filteredSummary: buildAdiSummary(filtered),
      },
    })
  } catch {
    return json({ error: 'Gestione ADI non disponibile.' }, 500)
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'Non autenticato' }, 401)

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return json({
      error: 'Dati ADI non validi.',
      field: parsed.error.issues[0]?.path.join('.') ?? 'payload',
      details: process.env.NODE_ENV === 'production' ? undefined : parsed.error.flatten(),
    }, 400)
  }

  try {
    const entries = await readEntries(supabase, user.id)
    const currentBalance = buildAdiSummary(entries).balance
    const body = parsed.data

    if (body.entryType === 'debit' && !canRegisterAdiDebit(currentBalance, body.amount)) {
      return json({ error: 'Il saldo ADI disponibile non è sufficiente per questa spesa.' }, 409)
    }

    if (body.entryType === 'debit' && body.transactionId) {
      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .select('id,user_id,type,amount')
        .eq('id', body.transactionId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (txError) return json({ error: 'Transazione collegata non verificabile.' }, 500)
      if (!tx) return json({ error: 'Transazione collegata non trovata o non autorizzata.' }, 404)
      if (tx.type !== 'expense') return json({ error: 'ADI può essere collegata solo a spese.' }, 400)
      if (Number(tx.amount) < body.amount) return json({ error: 'La spesa ADI non può superare l’importo della transazione collegata.' }, 400)
    }

    const payload = body.entryType === 'credit'
      ? {
        user_id: user.id,
        entry_type: 'credit',
        amount: body.amount,
        date: body.date,
        reference_period: body.referencePeriod ?? null,
        description: body.description,
        note: body.note ?? null,
        funding_source: 'ADI',
      }
      : {
        user_id: user.id,
        transaction_id: body.transactionId ?? null,
        entry_type: 'debit',
        adi_category: body.adiCategory,
        amount: body.amount,
        date: body.date,
        description: body.description,
        note: body.note ?? null,
        funding_source: 'ADI',
      }

    const { data, error } = await supabase.from('adi_entries').insert(payload as any).select().single()
    if (error) return json({ error: 'Registrazione ADI non riuscita.' }, 500)

    return json({ data }, 201)
  } catch {
    return json({ error: 'Errore interno nella gestione ADI.' }, 500)
  }
}
