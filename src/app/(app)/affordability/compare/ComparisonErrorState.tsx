'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'

export default function ComparisonErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" aria-live="assertive" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <p>{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Riprova
        </button>
      </div>
    </div>
  )
}
