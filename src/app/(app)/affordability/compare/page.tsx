'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, GitCompare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ComparisonProfile, CriterionKey, DecisionComparisonResult } from '@/lib/decision-comparison/types'
import ScenarioSelector from './ScenarioSelector'
import DecisionProfileSelector from './DecisionProfileSelector'
import CustomWeightsEditor from './CustomWeightsEditor'
import ComparisonLoadingState from './ComparisonLoadingState'
import ComparisonErrorState from './ComparisonErrorState'
import ComparisonSummary from './ComparisonSummary'
import ComparisonRanking from './ComparisonRanking'
import ComparisonCriteriaBreakdown from './ComparisonCriteriaBreakdown'
import ComparisonTradeoffs from './ComparisonTradeoffs'
import ComparisonWarnings from './ComparisonWarnings'
import ComparisonMethodology from './ComparisonMethodology'
import {
  buildComparePayload,
  canStartComparison,
  createEmptyDraft,
  generateScenarioId,
  validateCustomWeights,
  type ScenarioDraft,
} from './types'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function CompareAffordabilityPage() {
  const resultRegionRef = useRef<HTMLDivElement | null>(null)
  const [drafts, setDrafts] = useState<ScenarioDraft[]>(() => [
    createEmptyDraft(generateScenarioId(), 'generic'),
    createEmptyDraft(generateScenarioId(), 'generic'),
  ])
  const [profile, setProfile] = useState<ComparisonProfile>('BALANCED')
  const [customWeights, setCustomWeights] = useState<Partial<Record<CriterionKey, number>>>({})
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [result, setResult] = useState<DecisionComparisonResult | null>(null)

  const selectionCheck = canStartComparison(drafts)
  const weightsError = profile === 'CUSTOM' ? validateCustomWeights(customWeights) : null
  const canSubmit = selectionCheck.ok && !weightsError && status !== 'loading'

  async function handleCompare() {
    if (!canSubmit) return
    setStatus('loading')
    setErrorMessage(null)

    try {
      const payload = buildComparePayload(drafts, profile, profile === 'CUSTOM' ? customWeights : null)
      const res = await fetch('/api/affordability/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body?.error?.message ?? 'Non è stato possibile completare il confronto.')
      }
      setResult(body.data as DecisionComparisonResult)
      setStatus('success')
      setTimeout(() => resultRegionRef.current?.focus(), 50)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Non è stato possibile completare il confronto. Nessun dato finanziario è stato modificato.')
      setStatus('error')
      setTimeout(() => resultRegionRef.current?.focus(), 50)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
          <GitCompare className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Confronta le tue decisioni</h1>
          <p className="mt-1 text-sm text-slate-500">
            Confronta da 2 a 4 scenari di acquisto (generico, auto, casa o vacanza) in base al loro impatto finanziario.
          </p>
          <Link href="/affordability" className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Torna a &quot;Posso permettermelo?&quot;
          </Link>
        </div>
      </div>

      <ScenarioSelector drafts={drafts} onChange={setDrafts} />

      <DecisionProfileSelector profile={profile} onChange={setProfile} />

      {profile === 'CUSTOM' && <CustomWeightsEditor weights={customWeights} onChange={setCustomWeights} />}

      {!selectionCheck.ok && (
        <p role="status" className="text-xs text-slate-500">
          {selectionCheck.reason}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={handleCompare}
          disabled={!canSubmit}
          aria-busy={status === 'loading'}
          className="gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {status === 'loading' ? 'Confronto in corso...' : 'Confronta scenari'}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div ref={resultRegionRef} aria-live="polite" tabIndex={-1} className="scroll-mt-6 space-y-6 focus:outline-none">
        {status === 'loading' && <ComparisonLoadingState />}
        {status === 'error' && errorMessage && <ComparisonErrorState message={errorMessage} onRetry={handleCompare} />}
        {status === 'success' && result && (
          <section aria-label="Risultati del confronto" className="space-y-6">
            <ComparisonSummary result={result} />
            <ComparisonRanking result={result} />
            <ComparisonCriteriaBreakdown result={result} />
            <ComparisonTradeoffs result={result} />
            <ComparisonWarnings result={result} />
            <ComparisonMethodology result={result} />
          </section>
        )}
      </div>
    </div>
  )
}
