'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[aurora-error]', error.digest ?? error.name)
  }, [error])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f9fc] p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
        </div>
        <h1 className="mt-6 text-xl font-bold text-slate-950">Si è verificato un problema</h1>
        <p className="mt-3 text-sm text-slate-500">
          Non è stato possibile caricare questa pagina. Nessun dato è stato modificato.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-slate-400">Codice: {error.digest}</p>
        )}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <RefreshCw className="h-4 w-4" />
            Riprova
          </button>
          <a
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[#e5e7f0] bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Torna alla dashboard
          </a>
        </div>
      </div>
    </main>
  )
}
