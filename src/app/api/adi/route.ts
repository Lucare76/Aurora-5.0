import { NextResponse } from 'next/server'
import { z } from 'zod'
import { canAccessPrivateFinance } from '@/lib/access/private-finance-access'
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

const updateSchema = z.object({
  entryId: z.string().uuid(),
  amount: money,
  date: isoDate,
  referencePeriod: period,
  adiCategory: z.enum(ADI_CATEGORIES).nullable().optional(),
  description: z.string().trim().min(1).max(500),
  note: z.string().trim().max(5000).nullable().optional(),
}).strict()

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function forbidden() {
  return json({ error: { code: 'FORBIDDEN', message: 'Accesso non autorizzato.' } }, 403)
}

async function requireAdiAccess() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { supabase, user: null, response: json({ error: 'Non autenticato' }, 401) }
  if (!canAccessPrivateFinance(user.email)) return { supabase, user, response: forbidden() }

  return { supabase, user, response: null }
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
  const { supabase, user, response } = await requireAdiAccess()
  if (response) return response

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
  const { supabase, user, response } = await requireAdiAccess()
  if (response) return response

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

export async function PATCH(request: Request) {
  const { supabase, user, response } = await requireAdiAccess()
  if (response) return response

  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return json({
      error: 'Dati ADI non validi.',
      field: parsed.error.issues[0]?.path.join('.') ?? 'payload',
      details: process.env.NODE_ENV === 'production' ? undefined : parsed.error.flatten(),
    }, 400)
  }

  try {
    const body = parsed.data
    const entries = await readEntries(supabase, user.id)
    const current = entries.find((entry) => entry.id === body.entryId)
    if (!current) return json({ error: 'Movimento ADI non trovato o non autorizzato.' }, 404)

    const nextEntries = entries.map((entry) => {
      if (entry.id !== body.entryId) return entry
      return {
        ...entry,
        amount: body.amount,
        date: body.date,
        reference_period: current.entry_type === 'credit' ? body.referencePeriod ?? null : current.reference_period,
        adi_category: current.entry_type === 'debit' ? body.adiCategory ?? current.adi_category : null,
        description: body.description,
        note: body.note ?? null,
      }
    })

    if (buildAdiSummary(nextEntries).balance < 0) {
      return json({ error: 'La modifica porterebbe il residuo ADI sotto zero.' }, 409)
    }

    if (current.entry_type === 'debit') {
      if (!body.adiCategory) return json({ error: 'Seleziona una categoria ADI valida.' }, 400)
      if (current.transaction_id) {
        const { data: tx, error: txError } = await supabase
          .from('transactions')
          .select('id,user_id,type,amount')
          .eq('id', current.transaction_id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (txError) return json({ error: 'Transazione collegata non verificabile.' }, 500)
        if (!tx) return json({ error: 'Transazione collegata non trovata o non autorizzata.' }, 404)
        if (tx.type !== 'expense') return json({ error: 'ADI può essere collegata solo a spese.' }, 400)
        if (Number(tx.amount) < body.amount) return json({ error: 'La spesa ADI non può superare l’importo della transazione collegata.' }, 400)
      }
    }

    const payload = current.entry_type === 'credit'
      ? {
        amount: body.amount,
        date: body.date,
        reference_period: body.referencePeriod ?? null,
        description: body.description,
        note: body.note ?? null,
        adi_category: null,
      }
      : {
        amount: body.amount,
        date: body.date,
        adi_category: body.adiCategory,
        description: body.description,
        note: body.note ?? null,
      }

    const { data, error } = await supabase
      .from('adi_entries')
      .update(payload)
      .eq('id', body.entryId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return json({ error: 'Modifica movimento ADI non riuscita.' }, 500)
    return json({ data })
  } catch {
    return json({ error: 'Errore interno nella modifica ADI.' }, 500)
  }
}
