'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlaskConical } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { DEFAULT_ASSUMPTIONS } from '@/lib/scenarios/assumptions'
import { DEFAULT_HORIZON_MONTHS, SIMULATION_BADGE } from '@/lib/scenarios/constants'
import { SCENARIO_TEMPLATES } from '@/lib/scenarios/registry'
import type { ScenarioTemplate } from '@/lib/scenarios/types'

const BLANK_TEMPLATE: Pick<ScenarioTemplate, 'id' | 'label' | 'description' | 'icon'> = {
  id: '__blank__',
  label: 'Vuoto',
  description: 'Inizia da zero e aggiungi le azioni che preferisci.',
  icon: '📋',
}

export default function NewScenarioPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [horizon, setHorizon] = useState(DEFAULT_HORIZON_MONTHS)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('__blank__')
  const [submitting, setSubmitting] = useState(false)

  const today = new Date().toLocaleDateString('en-CA')

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Inserisci un nome per lo scenario.'); return }
    setSubmitting(true)
    try {
      const template = SCENARIO_TEMPLATES.find((t) => t.id === selectedTemplateId)

      const res = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          horizon_months: Math.max(1, Math.min(60, horizon)),
          start_date: today,
          actions: template
            ? template.seedActions.map((a, i) => ({ ...a, id: `seed-${i}` }))
            : [],
          assumptions: DEFAULT_ASSUMPTIONS,
        }),
      })

      if (!res.ok) throw new Error()
      const { data } = await res.json()
      router.push(`/scenarios/${data.id}`)
    } catch {
      toast.error('Errore durante la creazione dello scenario.')
      setSubmitting(false)
    }
  }

  const allTemplates = [BLANK_TEMPLATE, ...SCENARIO_TEMPLATES]

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <header>
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-indigo-500 shrink-0" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Nuovo scenario</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">{SIMULATION_BADGE}</p>
      </header>

      {/* ── Form ── */}
      <Card className="border-[#e5e7f0] bg-white">
        <CardContent className="p-5 sm:p-6 space-y-5">
          {/* Name */}
          <div>
            <Label htmlFor="sc-name">Nome *</Label>
            <Input
              id="sc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="es. Acquisto auto 2026"
              className="mt-1"
              maxLength={100}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="sc-desc">Descrizione <span className="text-slate-400 font-normal">(opzionale)</span></Label>
            <textarea
              id="sc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrivi brevemente l'ipotesi che vuoi simulare..."
              className="mt-1 w-full min-h-[72px] rounded-xl border border-[#e5e7f0] bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 resize-none"
              maxLength={500}
            />
          </div>

          {/* Horizon */}
          <div>
            <Label htmlFor="sc-horizon">Orizzonte temporale</Label>
            <div className="mt-1 flex items-center gap-3">
              <Input
                id="sc-horizon"
                type="number"
                min={1}
                max={60}
                value={horizon}
                onChange={(e) => setHorizon(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
                className="w-24"
              />
              <span className="text-sm text-slate-500">mesi (max 60)</span>
            </div>
          </div>

          {/* Template picker */}
          <div>
            <Label>Modello di partenza</Label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {allTemplates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(t.id)}
                  className={cn(
                    'text-left p-3 rounded-xl border-2 transition-all',
                    selectedTemplateId === t.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-[#e5e7f0] bg-white hover:border-indigo-200',
                  )}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-base leading-none">{t.icon}</span>
                    <span className="text-sm font-semibold text-slate-900">{t.label}</span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              Annulla
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={submitting || !name.trim()}
              className="w-full sm:w-auto"
            >
              {submitting ? 'Creazione...' : 'Crea scenario'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
