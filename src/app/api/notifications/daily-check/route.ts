import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
const resend = new Resend(process.env.RESEND_API_KEY!)

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount)
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const results = { birthdays: 0, recurring: 0, errors: [] as string[] }

  // ---- COMPLEANNI ----
  try {
    const { data: birthdays, error } = await supabase.from('birthdays').select('*')
    if (error) throw error

    for (const b of birthdays ?? []) {
      const born = new Date(`${b.birth_date}T00:00:00`)
      let next = new Date(today.getFullYear(), born.getMonth(), born.getDate())
      if (next < today) next = new Date(today.getFullYear() + 1, born.getMonth(), born.getDate())
      const daysUntil = Math.round((next.getTime() - today.getTime()) / 86400000)

      if (!(b.reminder_days as number[]).includes(daysUntil)) continue

      // Controlla se già inviato quest'anno per questo giorno-soglia
      const { data: existing } = await supabase
        .from('birthday_reminder_log')
        .select('id')
        .eq('birthday_id', b.id)
        .eq('days_before', daysUntil)
        .eq('year', today.getFullYear())
        .maybeSingle()

      if (existing) continue

      const { data: userData } = await supabase.auth.admin.getUserById(b.user_id)
      const userEmail = userData?.user?.email
      if (!userEmail) continue

      const age = next.getFullYear() - born.getFullYear()
      const label = daysUntil === 0 ? 'è oggi!' : `è tra ${daysUntil} ${daysUntil === 1 ? 'giorno' : 'giorni'}`

      const { error: sendError } = await resend.emails.send({
        from: 'Aurora <onboarding@resend.dev>',
        to: userEmail,
        subject: `🎂 Compleanno di ${b.name} ${label}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0f172a">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
              <div style="background:#6366f1;border-radius:12px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:20px">✨</div>
              <span style="font-size:20px;font-weight:700">Aurora</span>
            </div>
            <h2 style="margin:0 0 8px;font-size:22px">Promemoria compleanno</h2>
            <p style="margin:0 0 20px;color:#475569">
              Il compleanno di <strong>${escapeHtml(b.name)}</strong> ${label}<br>
              Compie <strong>${age} anni</strong>.
            </p>
            ${b.notes ? `<p style="background:#f8fafc;border-radius:8px;padding:12px;color:#64748b;margin:0">${escapeHtml(b.notes)}</p>` : ''}
          </div>`,
      })

      if (sendError) {
        results.errors.push(`Birthday ${b.id}: ${sendError.message}`)
        continue
      }

      await supabase.from('birthday_reminder_log').insert({
        birthday_id: b.id,
        user_id: b.user_id,
        days_before: daysUntil,
        year: today.getFullYear(),
      })
      results.birthdays++
    }
  } catch (err) {
    results.errors.push(`Birthdays: ${err instanceof Error ? err.message : String(err)}`)
  }

  // ---- RICORRENTI IN SCADENZA (entro 3 giorni) ----
  try {
    const in3Days = new Date(today)
    in3Days.setDate(today.getDate() + 3)
    const todayStr = today.toISOString().split('T')[0]
    const in3DaysStr = in3Days.toISOString().split('T')[0]

    const { data: recurring, error } = await supabase
      .from('recurring_rules')
      .select('*')
      .eq('is_active', true)
      .gte('next_due_date', todayStr)
      .lte('next_due_date', in3DaysStr)

    if (error) throw error

    for (const r of recurring ?? []) {
      const { data: userData } = await supabase.auth.admin.getUserById(r.user_id)
      const userEmail = userData?.user?.email
      if (!userEmail) continue

      const dueDate = new Date(`${r.next_due_date}T00:00:00`)
      const daysUntil = Math.round((dueDate.getTime() - today.getTime()) / 86400000)
      const label = daysUntil === 0 ? 'oggi' : `tra ${daysUntil} ${daysUntil === 1 ? 'giorno' : 'giorni'}`
      const typeLabel = r.type === 'expense' ? 'pagamento' : 'incasso'

      const { error: sendError } = await resend.emails.send({
        from: 'Aurora <onboarding@resend.dev>',
        to: userEmail,
        subject: `💳 ${escapeHtml(r.description)} in scadenza ${label}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0f172a">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
              <div style="background:#6366f1;border-radius:12px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:20px">✨</div>
              <span style="font-size:20px;font-weight:700">Aurora</span>
            </div>
            <h2 style="margin:0 0 8px;font-size:22px">Promemoria ${typeLabel}</h2>
            <p style="margin:0 0 20px;color:#475569">
              <strong>${escapeHtml(r.description)}</strong> di <strong>${formatAmount(Number(r.amount))}</strong>
              è previsto <strong>${label}</strong>.
            </p>
            <p style="color:#94a3b8;font-size:13px;margin:0">Scadenza: ${r.next_due_date}</p>
          </div>`,
      })

      if (sendError) {
        results.errors.push(`Recurring ${r.id}: ${sendError.message}`)
      } else {
        results.recurring++
      }
    }
  } catch (err) {
    results.errors.push(`Recurring: ${err instanceof Error ? err.message : String(err)}`)
  }

  const hasErrors = results.errors.length > 0
  return NextResponse.json(
    { success: !hasErrors, ...results },
    { status: hasErrors ? 207 : 200 },
  )
}
