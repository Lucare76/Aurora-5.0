'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAccounts } from '@/hooks/use-accounts'
import { useCategories } from '@/hooks/use-categories'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency } from '@/lib/utils'
import type { Account, Category } from '@/types/database'

// ─── types ────────────────────────────────────────────────────────────────────

type RowSource = 'bancoposta' | 'amex'
type RowType = 'income' | 'expense'

interface ParsedRow {
  id: string
  source: RowSource
  date: string
  description: string
  amount: number
  type: RowType
  account_id: string
  category_id: string
  included: boolean
  isDuplicate: boolean
  warning: string | null
}

interface TransferPair {
  id: string
  bancRow: { date: string; description: string; amount: number; account_id: string }
  amexRow: { date: string; description: string; amount: number; account_id: string }
}

// ─── constants ────────────────────────────────────────────────────────────────

const BP_AMEX_PAY_RE = /AMERICAN EXPRESS ITA CID\.IT07AEX0000014445281000/i
const AMEX_BP_PAY_RE = /ADDEBITO IN C\/C SALVO BUON FINE/i
const BP_COMMISSION_RE = /COMMISSIONI DOMICILIAZIONE.*AMERICAN EXPRESS ITA/i

// ─── parse helpers ────────────────────────────────────────────────────────────

function parseAmountAbs(val: unknown): number {
  if (typeof val === 'number') return Math.abs(val)
  if (typeof val === 'string' && val.trim()) {
    const cleaned = val.trim().replace(/\./g, '').replace(',', '.')
    return Math.abs(parseFloat(cleaned)) || 0
  }
  return 0
}

function parseAmountSigned(val: unknown): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string' && val.trim()) {
    const cleaned = val.trim().replace(/\./g, '').replace(',', '.')
    return parseFloat(cleaned) || 0
  }
  return 0
}

function parseDateBP(val: unknown): string | null {
  if (val instanceof Date) return val.toLocaleDateString('en-CA')
  if (typeof val === 'string') {
    const parts = val.split('/')
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10)
      const m = parseInt(parts[1], 10)
      const y = parseInt(parts[2], 10)
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
        return new Date(y, m - 1, d).toLocaleDateString('en-CA')
      }
    }
  }
  return null
}

function parseDateAmex(val: string): string | null {
  const parts = val.split('/')
  if (parts.length !== 3) return null
  const month = parseInt(parts[0], 10)
  const day = parseInt(parts[1], 10)
  const year = parseInt(parts[2], 10)
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null
  return new Date(year, month - 1, day).toLocaleDateString('en-CA')
}

function daysDiff(a: string, b: string): number {
  return Math.abs(
    new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime(),
  ) / 86400000
}

// ─── file parsers ─────────────────────────────────────────────────────────────

async function parseBancoposta(file: File, account: Account): Promise<ParsedRow[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(new Uint8Array(buf), { cellDates: true })
  const ws = wb.Sheets['ListaMovimenti'] ?? wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error('Foglio non trovato nel file Bancoposta')

  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as unknown[][]

  const headerIdx = raw.findIndex(
    (row) => Array.isArray(row) && row.some((c) => typeof c === 'string' && c.trim() === 'Data Contabile'),
  )
  if (headerIdx === -1) throw new Error('Intestazione "Data Contabile" non trovata nel foglio Bancoposta')

  const headers = (raw[headerIdx] as unknown[]).map((h) => (typeof h === 'string' ? h.trim() : ''))
  const iDate = headers.findIndex((h) => h === 'Data Contabile')
  const iDeb = headers.findIndex((h) => /addebiti/i.test(h))
  const iCred = headers.findIndex((h) => /accrediti/i.test(h))
  const iDesc = headers.findIndex((h) => /descrizione/i.test(h))

  if (iDate === -1 || iDesc === -1) throw new Error('Colonne attese non trovate nel file Bancoposta')

  const rows: ParsedRow[] = []
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i]
    if (!Array.isArray(row) || row.length === 0) continue
    const date = parseDateBP(row[iDate])
    if (!date) continue
    const addebiti = iDeb >= 0 ? parseAmountAbs(row[iDeb]) : 0
    const accrediti = iCred >= 0 ? parseAmountAbs(row[iCred]) : 0
    const desc = typeof row[iDesc] === 'string' ? (row[iDesc] as string).trim() : ''
    if (addebiti > 0) {
      rows.push({ id: crypto.randomUUID(), source: 'bancoposta', date, description: desc, amount: addebiti, type: 'expense', account_id: account.id, category_id: '', included: true, isDuplicate: false, warning: null })
    } else if (accrediti > 0) {
      rows.push({ id: crypto.randomUUID(), source: 'bancoposta', date, description: desc, amount: accrediti, type: 'income', account_id: account.id, category_id: '', included: true, isDuplicate: false, warning: null })
    }
  }
  return rows
}

async function parseAmex(file: File, account: Account): Promise<ParsedRow[]> {
  const text = await file.text()
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
    transform: (v: string) => v.trim(),
  })

  const first = result.data[0] ?? {}
  const keys = Object.keys(first)
  const dateKey = keys.find((k) => /^data/i.test(k)) ?? keys.find((k) => /date/i.test(k)) ?? 'Data'
  const amountKey = keys.find((k) => /importo/i.test(k)) ?? keys.find((k) => /amount/i.test(k)) ?? 'Importo'
  const descKey = keys.find((k) => /descrizione/i.test(k)) ?? keys.find((k) => /description/i.test(k)) ?? 'Descrizione'

  const rows: ParsedRow[] = []
  for (const row of result.data) {
    const date = parseDateAmex(row[dateKey] ?? '')
    if (!date) continue
    const importo = parseAmountSigned(row[amountKey] ?? '')
    if (importo === 0) continue
    const type: RowType = importo < 0 ? 'income' : 'expense'
    const amount = Math.abs(importo)
    const desc = (row[descKey] ?? '').trim()
    rows.push({ id: crypto.randomUUID(), source: 'amex', date, description: desc, amount, type, account_id: account.id, category_id: '', included: true, isDuplicate: false, warning: null })
  }
  return rows
}

// ─── sub-components ───────────────────────────────────────────────────────────

function FileZone({
  label,
  accept,
  Icon,
  file,
  accountFound,
  accountName,
  onFile,
}: {
  label: string
  accept: string
  Icon: React.ElementType
  file: File | null
  accountFound: boolean
  accountName: string
  onFile: (f: File | null) => void
}) {
  return (
    <Card className="border-[#e5e7f0] bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5 text-indigo-600" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <label
          className={cn(
            'relative flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition select-none',
            file ? 'border-indigo-300 bg-indigo-50/50' : 'border-[#e5e7f0] hover:border-indigo-300 hover:bg-indigo-50/30',
          )}
        >
          <input
            type="file"
            accept={accept}
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <>
              <CheckCircle2 className="h-8 w-8 text-indigo-500" />
              <p className="max-w-full truncate text-sm font-semibold text-indigo-700">{file.name}</p>
              <button
                type="button"
                className="absolute right-3 top-3 z-10 rounded-full bg-white p-1 shadow hover:bg-red-50"
                onClick={(e) => { e.preventDefault(); onFile(null) }}
                aria-label="Rimuovi file"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">Trascina o clicca per selezionare</p>
            </>
          )}
        </label>
        <div className={cn(
          'flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium',
          accountFound ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
        )}>
          {accountFound
            ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
          {accountFound
            ? `Conto "${accountName}" trovato`
            : `Conto "${accountName}" non trovato — crealo prima in Conti`}
        </div>
      </CardContent>
    </Card>
  )
}

function CategorySelect({
  value,
  type,
  expenseCats,
  incomeCats,
  onChange,
}: {
  value: string
  type: RowType
  expenseCats: Category[]
  incomeCats: Category[]
  onChange: (id: string) => void
}) {
  const cats = type === 'expense' ? expenseCats : incomeCats
  const parents = cats.filter((c) => !c.parent_id)
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full max-w-48 rounded-lg border border-[#e5e7f0] bg-white px-2 text-xs text-slate-700 outline-none focus:border-indigo-400"
    >
      <option value="">— nessuna —</option>
      {parents.map((parent) => {
        const children = cats.filter((c) => c.parent_id === parent.id)
        return children.length > 0 ? (
          <optgroup key={parent.id} label={parent.name}>
            {children.map((child) => (
              <option key={child.id} value={child.id}>{child.name}</option>
            ))}
          </optgroup>
        ) : (
          <option key={parent.id} value={parent.id}>{parent.name}</option>
        )
      })}
    </select>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function ImportEstratti() {
  const router = useRouter()
  const { accounts } = useAccounts()
  const { categories } = useCategories()
  const supabase = useMemo(() => createClient(), [])

  const [step, setStep] = useState<'upload' | 'preview'>('upload')
  const [bpFile, setBpFile] = useState<File | null>(null)
  const [amexFile, setAmexFile] = useState<File | null>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [transferPairs, setTransferPairs] = useState<TransferPair[]>([])
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)

  const bpAccount = useMemo(() => accounts.find((a) => a.name === 'Bancoposta'), [accounts])
  const amexAccount = useMemo(() => accounts.find((a) => a.name === 'Carta di Credito'), [accounts])

  const expenseCats = useMemo(
    () => categories.filter((c) => c.type === 'expense' || c.type === 'both'),
    [categories],
  )
  const incomeCats = useMemo(
    () => categories.filter((c) => c.type === 'income' || c.type === 'both'),
    [categories],
  )
  const commissionCat = useMemo(
    () =>
      categories.find((c) => c.name.toLowerCase() === 'commissioni banca') ??
      categories.find((c) => c.name.toLowerCase().includes('commissioni banca')) ??
      categories.find((c) => c.name.toLowerCase().includes('commissioni')),
    [categories],
  )

  const counts = useMemo(() => {
    const included = rows.filter((r) => r.included)
    return {
      expense: included.filter((r) => r.type === 'expense').length,
      income: included.filter((r) => r.type === 'income').length,
      duplicates: rows.filter((r) => r.isDuplicate).length,
      transfers: transferPairs.length,
      total: included.length + transferPairs.length,
    }
  }, [rows, transferPairs])

  const handleParse = useCallback(async () => {
    if (!bpFile && !amexFile) { toast.error('Carica almeno un file'); return }
    if (bpFile && !bpAccount) { toast.error('Conto "Bancoposta" non trovato — crealo in Conti'); return }
    if (amexFile && !amexAccount) { toast.error('Conto "Carta di Credito" non trovato — crealo in Conti'); return }

    setParsing(true)
    try {
      let bpRows: ParsedRow[] = []
      let amexRows: ParsedRow[] = []

      if (bpFile && bpAccount) bpRows = await parseBancoposta(bpFile, bpAccount)
      if (amexFile && amexAccount) amexRows = await parseAmex(amexFile, amexAccount)

      const bothLoaded = bpRows.length > 0 && amexRows.length > 0
      const pairsFound: TransferPair[] = []
      const usedBpIds = new Set<string>()
      const usedAmexIds = new Set<string>()

      for (const bp of bpRows) {
        // Commission: real expense — auto-assign category
        if (BP_COMMISSION_RE.test(bp.description) && bp.type === 'expense') {
          if (commissionCat) bp.category_id = commissionCat.id
          continue
        }
        // Transfer payment to Amex
        if (BP_AMEX_PAY_RE.test(bp.description) && bp.type === 'expense') {
          if (bothLoaded) {
            const match = amexRows.find(
              (ar) =>
                !usedAmexIds.has(ar.id) &&
                AMEX_BP_PAY_RE.test(ar.description) &&
                Math.abs(ar.amount - bp.amount) < 0.01 &&
                daysDiff(bp.date, ar.date) <= 5,
            )
            if (match) {
              usedBpIds.add(bp.id)
              usedAmexIds.add(match.id)
              pairsFound.push({
                id: crypto.randomUUID(),
                bancRow: { date: bp.date, description: bp.description || 'Pagamento Amex', amount: bp.amount, account_id: bp.account_id },
                amexRow: { date: match.date, description: match.description, amount: match.amount, account_id: match.account_id },
              })
            } else {
              bp.warning = "Possibile pareggio carta — verifica di non duplicare se importi anche l'altro estratto"
            }
          } else {
            bp.warning = "Possibile pareggio carta — verifica di non duplicare se importi anche l'altro estratto"
          }
        }
      }

      for (const ar of amexRows) {
        if (AMEX_BP_PAY_RE.test(ar.description) && !usedAmexIds.has(ar.id)) {
          ar.warning = "Possibile pareggio carta — verifica di non duplicare se importi anche l'altro estratto"
        }
      }

      const normalRows = [
        ...bpRows.filter((r) => !usedBpIds.has(r.id)),
        ...amexRows.filter((r) => !usedAmexIds.has(r.id)),
      ]

      // Duplicate detection
      const accountIds = [...new Set(normalRows.map((r) => r.account_id))]
      if (accountIds.length > 0) {
        const { data: existing } = await supabase
          .from('transactions')
          .select('date, amount, account_id')
          .in('account_id', accountIds)

        const existSet = new Set((existing ?? []).map((t) => `${t.account_id}|${t.date}|${t.amount}`))
        for (const row of normalRows) {
          if (existSet.has(`${row.account_id}|${row.date}|${row.amount}`)) {
            row.isDuplicate = true
            row.included = false
          }
        }
      }

      setRows(normalRows)
      setTransferPairs(pairsFound)
      setStep('preview')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore nel parsing del file')
    } finally {
      setParsing(false)
    }
  }, [bpFile, amexFile, bpAccount, amexAccount, commissionCat, supabase])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setProgress(0)
    const toSave = rows.filter((r) => r.included)
    const total = toSave.length + transferPairs.length
    if (total === 0) { setSaving(false); return }
    let done = 0
    let errors = 0

    const post = async (body: Record<string, unknown>) => {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const p = await res.json().catch(() => ({}))
        throw new Error(typeof p.error === 'string' ? p.error : 'Errore API')
      }
    }

    for (const row of toSave) {
      try {
        await post({
          account_id: row.account_id,
          type: row.type,
          amount: row.amount,
          description: row.description || 'Movimento importato',
          date: row.date,
          category_id: row.category_id || null,
        })
      } catch {
        errors++
      }
      setProgress(Math.round((++done / total) * 100))
    }

    for (const pair of transferPairs) {
      try {
        await post({
          account_id: pair.bancRow.account_id,
          destination_account_id: pair.amexRow.account_id,
          type: 'transfer',
          amount: pair.bancRow.amount,
          description: pair.bancRow.description || 'Pagamento carta Amex',
          date: pair.bancRow.date,
        })
      } catch {
        errors++
      }
      setProgress(Math.round((++done / total) * 100))
    }

    setSaving(false)
    const imported = total - errors
    if (errors === 0) {
      toast.success(`${imported} operazioni importate con successo`)
    } else {
      toast.warning(`${imported} importate, ${errors} errori`)
    }
    router.push('/transactions')
  }, [rows, transferPairs, router])

  const updateRow = useCallback((id: string, patch: Partial<ParsedRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }, [])

  const toggleAll = useCallback((checked: boolean) => {
    setRows((prev) => prev.map((r) => (r.isDuplicate ? r : { ...r, included: checked })))
  }, [])

  // ─── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-950">
      <div className="mx-auto max-w-6xl space-y-7">

        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-indigo-600">Importazione</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Importa estratti conto</h1>
            <p className="mt-2 text-sm text-slate-500">
              Bancoposta (.xlsx) e American Express (.csv) — con rilevamento automatico di trasferimenti e duplicati.
            </p>
          </div>
          {step === 'preview' && (
            <Button variant="outline" className="shrink-0 gap-2" onClick={() => setStep('upload')}>
              <ArrowLeft className="h-4 w-4" />
              Modifica file
            </Button>
          )}
        </header>

        {/* Step indicator */}
        <div className="flex items-center gap-3 text-sm">
          <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold', step === 'upload' ? 'bg-indigo-600 text-white' : 'bg-emerald-100 text-emerald-700')}>
            {step === 'upload' ? '1' : <CheckCircle2 className="h-4 w-4" />}
          </span>
          <span className={cn('font-medium', step === 'upload' ? 'text-slate-900' : 'text-slate-400')}>Carica file</span>
          <span className="h-px w-10 bg-slate-200" />
          <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold', step === 'preview' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400')}>2</span>
          <span className={cn('font-medium', step === 'preview' ? 'text-slate-900' : 'text-slate-400')}>Anteprima e conferma</span>
        </div>

        {/* ── UPLOAD STEP ── */}
        {step === 'upload' && (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <FileZone
                label="Estratto Bancoposta (.xlsx)"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                Icon={FileSpreadsheet}
                file={bpFile}
                accountFound={!!bpAccount}
                accountName="Bancoposta"
                onFile={setBpFile}
              />
              <FileZone
                label="Estratto American Express (.csv)"
                accept=".csv,text/csv"
                Icon={FileText}
                file={amexFile}
                accountFound={!!amexAccount}
                accountName="Carta di Credito"
                onFile={setAmexFile}
              />
            </div>
            <Button
              onClick={handleParse}
              disabled={(!bpFile && !amexFile) || parsing}
              className="h-12 gap-2 px-8"
            >
              {parsing ? 'Analisi in corso…' : 'Analizza e continua →'}
            </Button>
          </div>
        )}

        {/* ── PREVIEW STEP ── */}
        {step === 'preview' && (
          <div className="space-y-6">

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Uscite selezionate', value: counts.expense, color: 'text-red-600' },
                { label: 'Entrate selezionate', value: counts.income, color: 'text-emerald-600' },
                { label: 'Trasferimenti rilevati', value: counts.transfers, color: 'text-indigo-600' },
                { label: 'Possibili duplicati esclusi', value: counts.duplicates, color: 'text-amber-600' },
              ].map(({ label, value, color }) => (
                <Card key={label} className="border-[#e5e7f0] bg-white shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className={cn('mt-1 text-2xl font-bold tabular-nums', color)}>{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Transfer pairs */}
            {transferPairs.length > 0 && (
              <Card className="border-indigo-100 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-indigo-700">
                    <ArrowLeftRight className="h-4 w-4" />
                    Trasferimenti rilevati automaticamente ({transferPairs.length})
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    Questi movimenti verranno salvati come giroconto Bancoposta → Carta di Credito.
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {transferPairs.map((pair) => (
                    <div
                      key={pair.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {pair.bancRow.description}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          BP {pair.bancRow.date} · Amex {pair.amexRow.date}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums text-indigo-700">
                        {formatCurrency(pair.bancRow.amount)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Preview table */}
            <Card className="border-[#e5e7f0] bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">
                  Movimenti da importare
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    ({rows.length} totali, {rows.filter((r) => r.included).length} selezionati)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {rows.length === 0 ? (
                  <p className="px-6 py-8 text-center text-sm text-slate-500">Nessun movimento normale da importare.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[780px] text-sm">
                      <thead className="border-b border-[#e5e7f0] bg-slate-50/80">
                        <tr>
                          <th className="px-4 py-3 text-left">
                            <input
                              type="checkbox"
                              checked={rows.filter((r) => !r.isDuplicate).length > 0 && rows.filter((r) => !r.isDuplicate).every((r) => r.included)}
                              onChange={(e) => toggleAll(e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                              title="Seleziona/deseleziona tutti"
                            />
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500">Fonte</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500">Data</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500">Descrizione</th>
                          <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500">Importo</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500">Categoria</th>
                          <th className="px-3 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e5e7f0]">
                        {rows.map((row) => (
                          <tr
                            key={row.id}
                            className={cn(
                              'transition-colors',
                              !row.included && 'opacity-40',
                              row.isDuplicate && 'bg-red-50/30',
                            )}
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={row.included}
                                disabled={row.isDuplicate}
                                onChange={(e) => updateRow(row.id, { included: e.target.checked })}
                                className="h-4 w-4 rounded border-slate-300 accent-indigo-600 disabled:cursor-not-allowed"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <span className={cn(
                                'rounded-full px-2 py-0.5 text-xs font-semibold',
                                row.source === 'bancoposta' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700',
                              )}>
                                {row.source === 'bancoposta' ? 'BP' : 'Amex'}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-600">{row.date}</td>
                            <td className="max-w-64 px-3 py-3">
                              <p className="truncate text-slate-900">{row.description || '—'}</p>
                              {row.warning && (
                                <p className="mt-0.5 flex items-start gap-1 text-xs text-amber-600">
                                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                                  <span className="line-clamp-2">{row.warning}</span>
                                </p>
                              )}
                              {row.isDuplicate && (
                                <p className="mt-0.5 text-xs font-medium text-red-600">Possibile duplicato già importato</p>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right">
                              <span className={cn('font-semibold tabular-nums', row.type === 'income' ? 'text-emerald-600' : 'text-red-600')}>
                                {row.type === 'income' ? '+' : '−'}{formatCurrency(row.amount)}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <CategorySelect
                                value={row.category_id}
                                type={row.type}
                                expenseCats={expenseCats}
                                incomeCats={incomeCats}
                                onChange={(id) => updateRow(row.id, { category_id: id })}
                              />
                            </td>
                            <td className="px-3 py-3">
                              {row.isDuplicate && (
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                                  Duplicato
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Save */}
            <div className="flex items-center gap-4 pb-6">
              <Button
                onClick={handleSave}
                disabled={saving || counts.total === 0}
                className="h-12 gap-2 px-8"
              >
                {saving
                  ? `Importazione… ${progress}%`
                  : `Importa ${counts.total} operazioni selezionate`}
              </Button>
              {saving && (
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
              {counts.total === 0 && !saving && (
                <p className="text-sm text-slate-400">Nessun movimento selezionato da importare.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
