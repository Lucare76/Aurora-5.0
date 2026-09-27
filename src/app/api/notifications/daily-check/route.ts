import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { formatDate } from '@/lib/utils'
import { dateAfterDays, localDate, reminderKey, reminderStage, TIMELINE_REMINDER_DAYS } from '@/lib/timeline/reminders'
import { canAccessPrivateHr } from '@/lib/access/private-finance-access'

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

function advanceDate(dateStr: string, frequency: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  switch (frequency) {
    case 'daily':     d.setDate(d.getDate() + 1); break
    case 'weekly':    d.setDate(d.getDate() + 7); break
    case 'biweekly':  d.setDate(d.getDate() + 14); break
    case 'monthly':   d.setMonth(d.getMonth() + 1); break
    case 'quarterly': d.setMonth(d.getMonth() + 3); break
    case 'yearly':    d.setFullYear(d.getFullYear() + 1); break
  }
  return d.toISOString().split('T')[0]
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let supabase: ReturnType<typeof createAdminClient>
  try {
    // Runtime-only initialization: missing admin envs should fail this request,
    // never module import / Next.js page-data collection during build.
    supabase = createAdminClient()
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Supabase admin client is not configured' },
      { status: 503 },
    )
  }
  const resendApiKey = process.env.RESEND_API_KEY
  const resend = resendApiKey ? new Resend(resendApiKey) : null

  // The private timeline always gets in-app reminders, even if email is unavailable.
  const timelineResults = { created: 0, emailed: 0, errors: [] as string[] }
  const timelineToday = localDate(new Date())
  try {
    const dates = TIMELINE_REMINDER_DAYS.map((days) => dateAfterDays(timelineToday, days))
    const { data: events, error } = await supabase
      .from('personal_timeline_events')
      .select('id,user_id,event_date,title')
      .in('event_date', dates)
    if (error) throw error

    const eligibleUsers = new Map<string, boolean>()

    for (const event of events ?? []) {
      const days = reminderStage(event.event_date, timelineToday)
      if (!days) continue
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(event.user_id)
      if (userError || !canAccessPrivateHr(userData?.user?.email)) continue
      if (!eligibleUsers.has(event.user_id)) {
        const [settings, preference] = await Promise.all([
          supabase.from('notification_user_settings').select('notifications_enabled,show_info')
            .eq('user_id', event.user_id).maybeSingle(),
          supabase.from('notification_preferences').select('is_enabled')
            .eq('user_id', event.user_id).eq('notification_type', 'timeline_reminder').maybeSingle(),
        ])
        if (settings.error || preference.error) {
          timelineResults.errors.push(`Timeline preferences ${event.user_id}`)
          continue
        }
        eligibleUsers.set(event.user_id,
          settings.data?.notifications_enabled !== false && settings.data?.show_info !== false &&
          preference.data?.is_enabled !== false)
      }
      if (!eligibleUsers.get(event.user_id)) continue

      const key = reminderKey(event.id, event.event_date, days)
      const { data: inserted, error: insertError } = await supabase.from('notifications')
        .upsert({
          user_id: event.user_id,
          type: 'timeline_reminder',
          severity: 'INFO',
          title: `Timeline: evento tra ${days} giorni`,
          message: `${event.title} · ${formatDate(event.event_date)}`,
          dedupe_key: key,
          source_url: '/timeline',
          metadata: { event_id: event.id, event_date: event.event_date, days_before: days },
        }, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
        .select('id')
      if (insertError) {
        timelineResults.errors.push(`Timeline ${event.id}: ${insertError.message}`)
        continue
      }
      if (!inserted?.length) continue
      timelineResults.created++

      // Never send private event details by email. An email failure leaves the
      // in-app reminder intact; the unique key prevents duplicate alerts.
      if (resend && userData.user.email) {
        const { error: sendError } = await resend.emails.send({
          from: 'Aurora <onboarding@resend.dev>',
          to: userData.user.email,
          subject: `Promemoria Timeline: evento tra ${days} giorni`,
          html: `<p>Hai un evento nella Timeline tra ${days} giorni (${formatDate(event.event_date)}).</p><p>Apri Aurora per i dettagli.</p>`,
        })
        if (sendError) timelineResults.errors.push(`Timeline email ${event.id}: ${sendError.message}`)
        else timelineResults.emailed++
      }
    }
  } catch (error) {
    timelineResults.errors.push(`Timeline: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (!resend) {
    return NextResponse.json({ success: timelineResults.errors.length === 0, timeline: timelineResults, emailConfigured: false },
      { status: timelineResults.errors.length ? 207 : 200 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]
  const results = { birthdays: 0, auto_created: 0, recurring: 0, timeline: timelineResults, errors: timelineResults.errors }

  // ---- AUTO-CREATE TRANSAZIONI RICORRENTI ----
  try {
    const { data: autoRules, error } = await supabase
      .from('recurring_rules')
      .select('*')
      .eq('is_active', true)
      .eq('auto_create', true)
      .lte('next_due_date', todayStr)

    if (error) throw error

    for (const r of autoRules ?? []) {
      const { error: rpcError } = await supabase.rpc('create_recurring_transaction', {
        p_user_id:      r.user_id,
        p_account_id:   r.account_id,
        p_category_id:  r.category_id ?? null,
        p_type:         r.type,
        p_amount:       r.amount,
        p_description:  r.description,
        p_date:         r.next_due_date,
        p_recurring_id: r.id,
      })

      if (rpcError) {
        results.errors.push(`AutoCreate ${r.id}: ${rpcError.message}`)
        continue
      }

      const nextDue = advanceDate(r.next_due_date, r.frequency)
      const isExpired = r.end_date && nextDue > r.end_date

      await supabase
        .from('recurring_rules')
        .update({
          next_due_date: nextDue,
          last_run_date: todayStr,
          is_active: !isExpired,
        })
        .eq('id', r.id)

      const { data: userData } = await supabase.auth.admin.getUserById(r.user_id)
      const userEmail = userData?.user?.email
      if (userEmail) {
        const typeLabel = r.type === 'expense' ? 'uscita' : 'entrata'
        await resend.emails.send({
          from: 'Aurora <onboarding@resend.dev>',
          to: userEmail,
          subject: `✅ ${escapeHtml(r.description)} registrato automaticamente`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0f172a">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
                <div style="background:#6366f1;border-radius:12px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:20px">✨</div>
                <span style="font-size:20px;font-weight:700">Aurora</span>
              </div>
              <h2 style="margin:0 0 8px;font-size:22px">Transazione registrata</h2>
              <p style="margin:0 0 20px;color:#475569">
                Aurora ha registrato automaticamente un'<strong>${typeLabel}</strong> di
                <strong>${formatAmount(Number(r.amount))}</strong> per
                <strong>${escapeHtml(r.description)}</strong>.
              </p>
              <p style="color:#94a3b8;font-size:13px;margin:0">Prossima scadenza: ${formatDate(nextDue)}</p>
            </div>`,
        })
      }

      results.auto_created++
    }
  } catch (err) {
    results.errors.push(`AutoCreate: ${err instanceof Error ? err.message : String(err)}`)
  }

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

  // ---- REMINDER RICORRENTI (solo auto_create = false, entro 3 giorni) ----
  try {
    const in3Days = new Date(today)
    in3Days.setDate(today.getDate() + 3)
    const in3DaysStr = in3Days.toISOString().split('T')[0]

    const { data: recurring, error } = await supabase
      .from('recurring_rules')
      .select('*')
      .eq('is_active', true)
      .eq('auto_create', false)
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
            <p style="color:#94a3b8;font-size:13px;margin:0">Scadenza: ${formatDate(r.next_due_date)}</p>
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
