import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'

export const metadata: Metadata = { title: 'Pagina non trovata' }

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f9fc] p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25">
          <Sparkles className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-5xl font-bold tabular-nums text-slate-950">404</h1>
        <h2 className="mt-3 text-xl font-semibold text-slate-700">Pagina non trovata</h2>
        <p className="mt-3 text-sm text-slate-500">
          La pagina che stai cercando non esiste o è stata spostata.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Torna alla dashboard
          </Link>
          <Link
            href="/transactions"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[#e5e7f0] bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Vai ai movimenti
          </Link>
        </div>
      </div>
    </main>
  )
}
