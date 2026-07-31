'use client'

import type { DecisionComparisonResult } from '@/lib/decision-comparison/types'

export default function ComparisonMethodology({ result }: { result: DecisionComparisonResult }) {
  return (
    <details className="rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm">
      <summary className="cursor-pointer text-sm font-semibold text-slate-900">Come viene calcolato il confronto?</summary>
      <div className="mt-3 space-y-2 text-xs text-slate-600">
        <p>
          <strong>Normalizzazione:</strong> per ogni criterio, il valore di ciascuno scenario viene riportato su una scala 0-100 rispetto al minimo e al massimo osservati tra gli scenari confrontati.
        </p>
        <p>
          <strong>Pesi:</strong> ogni criterio ha un peso, definito dal profilo scelto ({result.profile === 'CUSTOM' ? 'pesi personalizzati' : 'profilo predefinito'}), che determina quanto influisce sul punteggio finale.
        </p>
        <p>
          <strong>Punteggio:</strong> i punteggi normalizzati vengono combinati secondo i pesi, poi corretti da una penalità di liquidità (per i mesi critici) e da un fattore di affidabilità basato sulla qualità dei dati disponibili per ciascuno scenario.
        </p>
        <p>
          <strong>Classifica:</strong> gli scenari sono ordinati per punteggio finale; differenze molto piccole vengono considerate parità.
        </p>
        <p>
          <strong>Trade-off:</strong> per ogni coppia di scenari viene indicato su quali criteri ciascuno prevale, e se uno "domina" l&apos;altro (mai peggiore su nessun criterio).
        </p>
        <p>
          <strong>Limiti:</strong> {result.disclaimer}
        </p>
      </div>
    </details>
  )
}
