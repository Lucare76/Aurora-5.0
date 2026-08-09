'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Database, Eye, Info, RefreshCw, ShieldCheck, ShieldAlert, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge, issueStatusLabel, severityLabel, statusToneFromIssueStatus, statusToneFromSeverity } from '@/components/ui/status-badge'
import { DATA_INTEGRITY_CATEGORY_LABELS } from '@/lib/data-integrity/constants'
import type { DataIntegrityCategory, DataIntegrityIssue, DataIntegrityScanRunRow, DataIntegritySeverity, DataIntegrityStatus, DataIntegritySummary } from '@/lib/data-integrity/types'

type ApiPayload = {
  issues: DataIntegrityIssue[]
  summary: DataIntegritySummary
  latestScan: DataIntegrityScanRunRow | null
  persistenceAvailable: boolean
}

type DuplicateMovement = {
  id: string
  date: string
  description: string
  amount: number
  type: 'income' | 'expense' | 'transfer'
  accountId: string
  accountName: string
  categoryId: string | null
  categoryName: string | null
  createdAt: string
  updatedAt: string
  recurringId: string | null
  transferPeerId: string | null
  sourceFingerprint: string | null
}

type DuplicateDetail = {
  issue: DataIntegrityIssue
  movements: DuplicateMovement[]
}

const severityOptions = ['all', 'CRITICAL', 'WARNING', 'INFO'] as const
const statusOptions = ['open', 'acknowledged', 'ignored', 'resolved', 'stale', 'all'] as const
const categoryOptions = ['all', ...Object.keys(DATA_INTEGRITY_CATEGORY_LABELS)] as Array<'all' | DataIntegrityCategory>

function formatDateTime(value?: string | null) {
  if (!value) return 'Mai'
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function DataIntegrityPageContent() {
  const searchParams = useSearchParams()
  const [payload, setPayload] = useState<ApiPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [selected, setSelected] = useState<DataIntegrityIssue | null>(null)
  const [status, setStatus] = useState<typeof statusOptions[number]>(() => statusOptions.includes(searchParams.get('status') as never) ? searchParams.get('status') as typeof statusOptions[number] : 'open')
  const [severity, setSeverity] = useState<typeof severityOptions[number]>(() => severityOptions.includes(searchParams.get('severity') as never) ? searchParams.get('severity') as typeof severityOptions[number] : 'all')
  const [category, setCategory] = useState<typeof categoryOptions[number]>(() => categoryOptions.includes(searchParams.get('category') as never) ? searchParams.get('category') as typeof categoryOptions[number] : 'all')
  const [liveMessage, setLiveMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status, severity, category })
      const rule = searchParams.get('rule')
      if (rule) params.set('rule', rule)
      const response = await fetch(`/api/data-integrity?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('LOAD_FAILED')
      const body = await response.json() as ApiPayload
      setPayload(body)
      setSelected((current) => current ? body.issues.find((issue) => issue.id === current.id) ?? null : null)
    } catch (error) {
      console.error('[data-integrity]', error)
      toast.error('Impossibile caricare il centro integrità dati.')
    } finally {
      setLoading(false)
    }
  }, [category, searchParams, severity, status])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (searchParams.get('action') === 'scan') void runScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runScan = async () => {
    if (!window.confirm('Avviare una scansione dei dati? La scansione non modifica movimenti, saldi o dati finanziari.')) return
    setScanning(true)
    setLiveMessage('Scansione integrità avviata.')
    try {
      const response = await fetch('/api/data-integrity/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'quick' }),
      })
      if (!response.ok) throw new Error('SCAN_FAILED')
      toast.success('Scansione completata.')
      setLiveMessage('Scansione integrità completata.')
      await load()
    } catch (error) {
      console.error('[data-integrity:scan]', error)
      toast.error('Scansione non riuscita.')
      setLiveMessage('Scansione integrità non riuscita.')
    } finally {
      setScanning(false)
    }
  }

  const updateStatus = async (issue: DataIntegrityIssue, nextStatus: DataIntegrityStatus) => {
    if (!issue.id) return
    const reason = nextStatus === 'ignored' ? window.prompt('Motivo opzionale per ignorare questa issue') : null
    try {
      const response = await fetch(`/api/data-integrity/issues/${issue.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, reason }),
      })
      if (!response.ok) throw new Error('STATUS_FAILED')
      toast.success('Stato issue aggiornato.')
      await load()
    } catch (error) {
      console.error('[data-integrity:status]', error)
      toast.error('Impossibile aggiornare lo stato.')
    }
  }

  const activeIssues = payload?.issues ?? []
  const summary = payload?.summary
  const selectedIssue = selected ?? activeIssues[0] ?? null

  const cards = useMemo(() => [
    { label: 'Critiche aperte', value: summary?.critical ?? 0, icon: ShieldAlert, className: 'text-red-600 bg-red-50' },
    { label: 'Da controllare', value: summary?.warning ?? 0, icon: AlertTriangle, className: 'text-amber-600 bg-amber-50' },
    { label: 'Informazioni', value: summary?.info ?? 0, icon: Info, className: 'text-sky-600 bg-sky-50' },
    { label: 'Stato integrità', value: summary?.statusLabel ?? 'Nessun dato', icon: ShieldCheck, className: 'text-indigo-600 bg-indigo-50' },
  ], [summary])

  if (loading && !payload) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 rounded-3xl" />
        <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)}</div>
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="sr-only" aria-live="polite">{liveMessage}</div>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-600">Data Integrity Center</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Integrità dati</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Analizza anomalie, duplicazioni e riferimenti incoerenti senza modificare automaticamente i dati finanziari.
            </p>
            <p className="mt-1 text-xs text-slate-400">Ultima scansione: {formatDateTime(payload?.latestScan?.completed_at ?? payload?.latestScan?.started_at)}</p>
          </div>
          <Button onClick={runScan} disabled={scanning} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scansione...' : 'Avvia scansione'}
          </Button>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="border-slate-200 bg-white shadow-sm">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-sm font-medium text-slate-500">{card.label}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{card.value}</p>
              </div>
              <span className={`rounded-2xl p-3 ${card.className}`}><card.icon className="h-5 w-5" /></span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Problemi rilevati</CardTitle>
          <CardDescription>Filtra per stato, gravità e categoria. Nessuna azione modifica dati finanziari direttamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            <Filter label="Stato" value={status} options={statusOptions.map((value) => ({ value, label: value === 'all' ? 'Tutti' : issueStatusLabel(value as DataIntegrityStatus) }))} onChange={(value) => setStatus(value as typeof status)} />
            <Filter label="Priorità" value={severity} options={severityOptions.map((value) => ({ value, label: value === 'all' ? 'Tutte' : severityLabel(value as DataIntegritySeverity) }))} onChange={(value) => setSeverity(value as typeof severity)} />
            <Filter label="Categoria" value={category} options={categoryOptions.map((value) => ({ value, label: value === 'all' ? 'Tutte' : DATA_INTEGRITY_CATEGORY_LABELS[value] }))} onChange={(value) => setCategory(value as typeof category)} />
          </div>

          {activeIssues.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <h2 className="mt-4 text-lg font-bold text-slate-950">Nessuna anomalia rilevata nei controlli eseguiti.</h2>
              <p className="mt-2 text-sm text-slate-500">Questo non garantisce l'assenza assoluta di errori, ma le regole attive non hanno trovato problemi per il filtro corrente.</p>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
              <div className="space-y-3">
                {activeIssues.map((issue) => (
                  <button key={issue.fingerprint} type="button" onClick={() => setSelected(issue)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedIssue?.fingerprint === issue.fingerprint ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-200 bg-white hover:border-indigo-200'}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={statusToneFromSeverity(issue.severity)} label={severityLabel(issue.severity)} />
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">{DATA_INTEGRITY_CATEGORY_LABELS[issue.category]}</span>
                      <StatusBadge tone={statusToneFromIssueStatus(issue.status)} label={issueStatusLabel(issue.status)} />
                    </div>
                    <h3 className="mt-3 font-bold text-slate-950">{issue.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">{issue.explanation}</p>
                    <p className="mt-3 text-xs text-slate-400">Ultima rilevazione: {formatDateTime(issue.lastDetectedAt)}</p>
                  </button>
                ))}
              </div>
              <IssueDetail issue={selectedIssue} onStatus={updateStatus} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function DataIntegrityPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
      <DataIntegrityPageContent />
    </Suspense>
  )
}

function Filter({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function IssueDetail({ issue, onStatus }: { issue: DataIntegrityIssue | null; onStatus: (issue: DataIntegrityIssue, status: DataIntegrityStatus) => void }) {
  if (!issue) return null
  return (
    <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:sticky lg:top-6 lg:self-start">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Dettaglio issue</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">{issue.title}</h2>
        </div>
        <Database className="h-6 w-6 text-indigo-500" />
      </div>
      <div className="mt-5 space-y-4">
        <DetailBlock title="Perché questa segnalazione?" text={issue.explanation} />
        <DetailBlock title="Impatto possibile" text={issue.impact} />
        <DetailBlock title="Proposta" text={issue.recommendation} />
        <div>
          <h3 className="text-sm font-bold text-slate-900">Evidenze</h3>
          <dl className="mt-2 space-y-2">
            {issue.evidence.length === 0 ? <p className="text-sm text-slate-500">Nessuna evidenza aggiuntiva.</p> : issue.evidence.map((item, index) => (
              <div key={`${item.label}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</dt>
                <dd className="mt-1 break-words text-sm font-medium text-slate-800">{String(item.value ?? 'n.d.')}</dd>
              </div>
            ))}
          </dl>
        </div>
        <DuplicateComparison issue={issue} onStatus={onStatus} />
        <div className="grid gap-2">
          {issue.sourcePath ? (
            <Link href={issue.sourcePath} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50">
              <Eye className="h-4 w-4" />
              Apri record
            </Link>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" type="button" onClick={() => onStatus(issue, 'acknowledged')}>Riconosci</Button>
            <Button variant="outline" type="button" onClick={() => onStatus(issue, 'ignored')}>Ignora</Button>
            <Button variant="outline" type="button" onClick={() => onStatus(issue, 'open')}>Riapri</Button>
            <Button variant="outline" type="button" onClick={() => onStatus(issue, 'resolved')}>Segna risolta</Button>
          </div>
        </div>
      </div>
    </aside>
  )
}

function DuplicateComparison({ issue, onStatus }: { issue: DataIntegrityIssue; onStatus: (issue: DataIntegrityIssue, status: DataIntegrityStatus) => void }) {
  const [detail, setDetail] = useState<DuplicateDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteChoicesOpen, setDeleteChoicesOpen] = useState(false)
  const isDuplicate = issue.ruleCode === 'TRANSACTION_EXACT_DUPLICATE' || issue.ruleCode === 'TRANSACTION_POSSIBLE_DUPLICATE'

  useEffect(() => {
    if (!isDuplicate || !issue.id) {
      setDetail(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setDeleteChoicesOpen(false)
    fetch(`/api/data-integrity/issues/${issue.id}/duplicate`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('DUPLICATE_DETAIL_FAILED')
        return response.json() as Promise<DuplicateDetail>
      })
      .then((body) => {
        if (!cancelled) setDetail(body)
      })
      .catch((error) => {
        console.error('[data-integrity:duplicate-detail]', error)
        if (!cancelled) {
          setDetail(null)
          toast.error('Impossibile caricare il confronto movimenti.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isDuplicate, issue.id])

  if (!isDuplicate) return null

  const movements = detail?.movements ?? []
  const [first, second] = movements

  const deleteMovement = async (movement: DuplicateMovement, label: 'A' | 'B') => {
    if (!issue.id) return
    const confirmed = window.confirm(`Eliminare il Movimento ${label}?\n\nData: ${movement.date}\nImporto: ${formatMoney(movement.amount)}\nDescrizione: ${movement.description || 'Senza descrizione'}\nConto: ${movement.accountName}\n\nL'azione usa il flusso atomico esistente e non viene eseguita automaticamente.`)
    if (!confirmed) return
    setDeleting(movement.id)
    try {
      const response = await fetch(`/api/data-integrity/issues/${issue.id}/duplicate`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: movement.id }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error ?? 'DELETE_FAILED')
      }
      toast.success('Movimento eliminato e issue marcata come risolta.')
      window.location.reload()
    } catch (error) {
      console.error('[data-integrity:duplicate-delete]', error)
      toast.error('Eliminazione non riuscita. Verifica il movimento e riprova.')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <section className="rounded-2xl border border-indigo-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Confronto movimenti</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {issue.ruleCode === 'TRANSACTION_POSSIBLE_DUPLICATE'
              ? 'Questi movimenti hanno gli stessi dati principali ma categorie diverse.'
              : 'Questi due movimenti coincidono su conto, tipo, data, importo, descrizione e categoria.'}
          </p>
          {first && second && first.createdAt === second.createdAt ? (
            <p className="mt-1 text-xs font-semibold text-amber-700">Creati nello stesso istante.</p>
          ) : null}
        </div>
        <StatusBadge tone="warning" label="Verifica manuale" />
      </div>

      {loading ? <Skeleton className="mt-4 h-40 rounded-2xl" /> : null}
      {!loading && movements.length < 2 ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Uno dei movimenti non risulta piu disponibile: la issue potrebbe essere stale.</p>
      ) : null}
      {!loading && first && second ? (
        <>
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            <MovementCard label="A" movement={first} other={second} />
            <MovementCard label="B" movement={second} other={first} />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link href={`/transactions?id=${first.id}`} className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Apri movimento A</Link>
            <Link href={`/transactions?id=${second.id}`} className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Apri movimento B</Link>
            <Button variant="outline" type="button" onClick={() => onStatus(issue, 'ignored')}>Non è un duplicato</Button>
            <Button variant="outline" type="button" onClick={() => setDeleteChoicesOpen((value) => !value)}>
              Elimina duplicato
            </Button>
            {deleteChoicesOpen ? (
              <>
                <Button variant="outline" type="button" disabled={Boolean(deleting)} onClick={() => deleteMovement(first, 'A')} className="border-red-200 text-red-700 hover:bg-red-50">
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deleting === first.id ? 'Elimino A...' : 'Elimina Movimento A'}
                </Button>
                <Button variant="outline" type="button" disabled={Boolean(deleting)} onClick={() => deleteMovement(second, 'B')} className="border-red-200 text-red-700 hover:bg-red-50">
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deleting === second.id ? 'Elimino B...' : 'Elimina Movimento B'}
                </Button>
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  )
}

function MovementCard({ label, movement, other }: { label: 'A' | 'B'; movement: DuplicateMovement; other: DuplicateMovement }) {
  const fields = [
    ['ID', shortId(movement.id), shortId(other.id), true],
    ['Data', movement.date, other.date],
    ['Descrizione', movement.description || 'Senza descrizione', other.description || 'Senza descrizione'],
    ['Importo', formatMoney(movement.amount), formatMoney(other.amount)],
    ['Tipo', movementTypeLabel(movement.type), movementTypeLabel(other.type)],
    ['Conto', movement.accountName, other.accountName],
    ['Categoria', movement.categoryName ?? 'Nessuna categoria', other.categoryName ?? 'Nessuna categoria'],
    ['Creato il', formatDateTime(movement.createdAt), formatDateTime(other.createdAt)],
    ['Ricorrenza', movement.recurringId ? shortId(movement.recurringId) : 'No', other.recurringId ? shortId(other.recurringId) : 'No'],
    ['Giroconto legacy', movement.transferPeerId ? shortId(movement.transferPeerId) : 'No', other.transferPeerId ? shortId(other.transferPeerId) : 'No'],
    ['Import/source', movement.sourceFingerprint ?? 'Non presente', other.sourceFingerprint ?? 'Non presente'],
  ] as const
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-sm font-bold text-slate-950">Movimento {label}</h4>
      <dl className="mt-3 space-y-2">
        {fields.map(([name, value, otherValue, forceDifferent]) => {
          const same = !forceDifferent && value === otherValue
          return (
            <div key={name} className={`rounded-xl border p-2 ${same ? 'border-emerald-100 bg-emerald-50/60' : 'border-amber-100 bg-amber-50/60'}`}>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{name}</dt>
              <dd className="mt-0.5 break-words text-xs font-semibold text-slate-800">{value}</dd>
            </div>
          )
        })}
      </dl>
    </article>
  )
}

function shortId(value: string) {
  return value.slice(0, 8)
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value)
}

function movementTypeLabel(value: DuplicateMovement['type']) {
  if (value === 'income') return 'Entrata'
  if (value === 'expense') return 'Uscita'
  return 'Giroconto'
}

function DetailBlock({ title, text }: { title: string; text: string }) {
  return (
    <section>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
    </section>
  )
}
