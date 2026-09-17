'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Circle, RefreshCw, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  isOnboardingCoreComplete,
  onboardingProgress,
  onboardingSteps,
  type OnboardingStatus,
} from '@/lib/onboarding'

export default function OnboardingPage() {
  const router = useRouter()
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  const markDone = useCallback(async (silent = false) => {
    setSaving(true)
    try {
      const response = await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: true }),
      })
      if (!response.ok) throw new Error('ONBOARDING_UPDATE_FAILED')
      if (!silent) toast.success('Configurazione iniziale completata.')
      router.replace('/dashboard')
      router.refresh()
    } catch (cause) {
      console.error('[onboarding]', cause)
      toast.error('Non riesco a salvare la configurazione. Riprova.')
    } finally {
      setSaving(false)
    }
  }, [router])

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const response = await fetch('/api/onboarding', { cache: 'no-store' })
      if (!response.ok) throw new Error('ONBOARDING_LOAD_FAILED')
      const body = await response.json() as OnboardingStatus

      if (body.onboardingDone) {
        router.replace('/dashboard')
        return
      }

      if (isOnboardingCoreComplete(body)) {
        await markDone(true)
        return
      }

      setStatus(body)
    } catch (cause) {
      console.error('[onboarding]', cause)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [markDone, router])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !status) {
    return (
      <main className="min-h-screen bg-[#f8f9fc] p-4 md:p-8">
        <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <RefreshCw className="mx-auto h-7 w-7 animate-spin text-indigo-500" />
          <p className="mt-3 text-sm text-slate-500">Preparazione della configurazione iniziale…</p>
        </div>
      </main>
    )
  }

  if (error || !status) {
    return (
      <main className="min-h-screen bg-[#f8f9fc] p-4 md:p-8">
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Sparkles className="mx-auto h-9 w-9 text-indigo-500" />
          <h1 className="mt-4 text-2xl font-bold text-slate-950">Configurazione non disponibile</h1>
          <p className="mt-2 text-sm text-slate-500">Puoi riprovare senza modificare alcun dato.</p>
          <Button className="mt-5" onClick={() => void load()}>Riprova</Button>
        </div>
      </main>
    )
  }

  const progress = onboardingProgress(status)

  return (
    <main className="min-h-screen bg-[#f8f9fc] p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 p-6 text-white shadow-lg md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <Sparkles className="h-6 w-6" />
              </div>
              <p className="mt-5 text-sm font-semibold text-indigo-100">Primi passi</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">Configura Aurora in pochi minuti</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100">
                Ti guidiamo solo nelle tre cose indispensabili. Tutto il resto potrai configurarlo quando vuoi.
              </p>
            </div>
            <div className="min-w-44 rounded-2xl bg-white/10 p-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-100">Avanzamento</p>
              <p className="mt-1 text-3xl font-bold">{progress}%</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          {onboardingSteps.map((step, index) => {
            const done = Boolean(status[step.key])
            return (
              <Card key={step.key} className={cn('border shadow-sm', done ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white')}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-bold', done ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-50 text-indigo-700')}>
                      {done ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-bold text-slate-950">{step.title}</h2>
                        {!step.required && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Facoltativo</span>}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{step.description}</p>
                      {done ? (
                        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" /> Completato
                        </p>
                      ) : (
                        <Link href={step.href} className={buttonVariants({ variant: 'outline', size: 'sm', className: 'mt-4' })}>
                          {step.action}
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Circle className="mt-0.5 h-5 w-5 text-slate-300" />
            <div>
              <p className="font-semibold text-slate-900">Vuoi continuare più tardi?</p>
              <p className="mt-1 text-sm text-slate-500">Puoi entrare subito nella Dashboard e configurare il resto in autonomia.</p>
            </div>
          </div>
          <Button variant="ghost" disabled={saving} onClick={() => void markDone()}>
            {saving ? 'Salvataggio…' : 'Non mostrare più la guida'}
          </Button>
        </section>
      </div>
    </main>
  )
}
