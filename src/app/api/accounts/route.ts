import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const createAccountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['checking', 'savings', 'cash', 'credit', 'investment', 'other']),
  balance: z.number(),
  currency: z.string().default('EUR'),
})

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
    const parsed = createAccountSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const data = parsed.data

    const payload = {
      user_id: user.id,
      name: data.name,
      type: data.type,
      balance: data.balance,
      currency: data.currency,
      is_active: true,
      sort_order: 0,
      color: null,
      icon: null,
    }

    const { data: account, error } = await supabase
      .from('accounts')
      .insert(payload as never)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: account }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 },
    )
  }
}
