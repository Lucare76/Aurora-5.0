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
  Zap,
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
type RowType = 'income' | 'expense' | 'transfer'

interface ParsedRow {
  id: string
  source: RowSource
  date: string
  description: string
  amount: number
  type: RowType
  account_id: string
  destination_account_id: string  // for manual and auto-pattern transfers
  category_id: string
  included: boolean
  isDuplicate: boolean
  warning: string | null
  autoDetectedTransfer: boolean   // true when matched by KNOWN_TRANSFER_PATTERNS
}

interface TransferPair {
  id: string
  bancRow: { date: string; description: string; amount: number; account_id: string }
  amexRow: { date: string; description: string; amount: number; account_id: string }
}

// ─── known transfer patterns ──────────────────────────────────────────────────
// Facilmente estendibile: aggiungi righe per altri pattern ricorrenti.

const KNOWN_TRANSFER_PATTERNS: { pattern: RegExp; destinationAccountName: string }[] = [
  { pattern: /RATA.*POLIZZA VITA/i, destinationAccountName: 'PostaPrevidenza Valore' },
]

// ─── Amex pair auto-detection constants ───────────────────────────────────────

const BP_AMEX_PAY_RE = /AMERICAN EXPRESS ITA CID\.IT07AEX0000014445281000/i
const AMEX_BP_PAY_RE = /ADDEBITO IN C\/C SALVO BUON FINE/i
const BP_COMMISSION_RE = /COMMISSIONI DOMICILIAZIONE.*AMERICAN EXPRESS ITA/i

// ─── parse helpers ────────────────────────────────────────────────────────────

function parseAmountAbs(val: unknown): number {
  if (typeof val === 'number') return Math.abs(val)
  if (typeof val === 'string' && val.trim()) {
    return Math.abs(parseFloat(val.trim().replace(/\./g, '').replace(',', '.'))) || 0
  }
  return 0
}

function parseAmountSigned(val: unknown): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string' && val.trim()) {
    return parseFloat(val.trim().replace(/\./g, '').replace(',', '.')) || 0
  }
  return 0
}

function parseDateBP(val: unknown): string | null {
  if (val instanceof Date) return val.toLocaleDateString('en-CA')
  if (typeof val === 'string') {
    const [p0, p1, p2] = val.split('/')
    const d = parseInt(p0, 10), m = parseInt(p1, 10), y = parseInt(p2, 10)
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m - 1, d).toLocaleDateString('en-CA')
  }
  return null
}

function parseDateAmex(val: string): string | null {
  const [p0, p1, p2] = val.split('/')
  const month = parseInt(p0, 10), day = parseInt(p1, 10), year = parseInt(p2, 10)
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null
  return new Date(year, month - 1, day).toLocaleDateString('en-CA')
}

function daysDiff(a: string, b: string): number {
  return Math.abs(new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime()) / 86400000
}

function makeRow(
  source: RowSource,
  date: string,
  desc: string,
  amount: number,
  type: 'income' | 'expense',
  account_id: string,
): ParsedRow {
  return {
    id: crypto.randomUUID(),
    source,
    date,
    description: desc,
    amount,
    type,
    account_id,
    destination_account_id: '',
    category_id: '',
    included: true,
    isDuplicate: false,
    warning: null,
    autoDetectedTransfer: false,
  }
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
    if (addebiti > 0) rows.push(makeRow('bancoposta', date, desc, addebiti, 'expense', account.id))
    else if (accrediti > 0) rows.push(makeRow('bancoposta', date, desc, accrediti, 'income', account.id))
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
    const type: 'income' | 'expense' = importo < 0 ? 'income' : 'expense'
    rows.push(makeRow('amex', date, (row[descKey] ?? '').trim(), Math.abs(importo), type, account.id))
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
        <label className={cn(
          'relative flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center transition select-none',
          file ? 'border-indigo-300 bg-indigo-50/50' : 'border-[#e5e7f0] hover:border-indigo-300 hover:bg-indigo-50/30',
        )}>
          <input type="file" accept={accept} className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          {file ? (
            <>
              <CheckCircle2 className="h-7 w-7 text-indigo-500" />
              <p className="max-w-full truncate text-sm font-semibold text-indigo-700">{file.name}</p>
              <button type="button" className="absolute right-2 top-2 z-10 rounded-full bg-white p-1 shadow hover:bg-red-50" onClick={(e) => { e.preventDefault(); onFile(null) }} aria-label="Rimuovi">
                <AlertTriangle className="h-3 w-3 text-slate-400" />
              </button>
            </>
          ) : (
            <>
              <Upload className="h-7 w-7 text-slate-300" />
              <p className="text-xs text-slate-500">Trascina o clicca per selezionare</p>
            </>
          )}
        </label>
        <div className={cn('flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium', accountFound ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
          {accountFound ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
          {accountFound ? `Conto "${accountName}" trovato` : `Conto "${accountName}" non trovato — crealo in Conti`}
        </div>
      </CardContent>
    </Card>
  )
}

// Compact inline select shared by the table
function Sel({ value, onChange, className, children }: {
  value: string
  onChange: (v: string) => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn('h-7 rounded-md border border-[#e5e7f0] bg-white px-1.5 text-[11px] text-slate-700 outline-none focus:border-indigo-400', className)}
    >
      {children}
    </select>
  )
}

function CategorySelect({ value, type, expenseCats, incomeCats, onChange }: {
  value: string
  type: RowType
  expenseCats: Category[]
  incomeCats: Category[]
  onChange: (id: string) => void
}) {
  const cats = type === 'expense' ? expenseCats : incomeCats
  const parents = cats.filter((c) => !c.parent_id)
  return (
    <Sel value={value} onChange={onChange} className="w-36">
      <option value="">— cat. —</option>
      {parents.map((p) => {
        const children = cats.filter((c) => c.parent_id === p.id)
        return children.length > 0 ? (
          <optgroup key={p.id} label={p.name}>
            {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </optgroup>
        ) : <option key={p.id} value={p.id}>{p.name}</option>
      })}
    </Sel>
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
  const activeAccounts = useMemo(() => accounts.filter((a) => a.is_active), [accounts])

  const expenseCats = useMemo(() => categories.filter((c) => c.type === 'expense' || c.type === 'both'), [categories])
  const incomeCats = useMemo(() => categories.filter((c) => c.type === 'income' || c.type === 'both'), [categories])
  const commissionCat = useMemo(
    () => categories.find((c) => c.name.toLowerCase() === 'commissioni banca')
      ?? categories.find((c) => c.name.toLowerCase().includes('commissioni banca'))
      ?? categories.find((c) => c.name.toLowerCase().includes('commissioni')),
    [categories],
  )

  const counts = useMemo(() => {
    const included = rows.filter((r) => r.included)
    const manualTransfers = included.filter((r) => r.type === 'transfer').length
    return {
      expense: included.filter((r) => r.type === 'expense').length,
      income: included.filter((r) => r.type === 'income').length,
      manualTransfers,
      autoTransfers: transferPairs.length,
      duplicates: rows.filter((r) => r.isDuplicate).length,
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

      // — Auto-detect BP↔Amex transfer pairs —
      const bothLoaded = bpRows.length > 0 && amexRows.length > 0
      const pairsFound: TransferPair[] = []
      const usedBpIds = new Set<string>()
      const usedAmexIds = new Set<string>()

      for (const bp of bpRows) {
        if (BP_COMMISSION_RE.test(bp.description) && bp.type === 'expense') {
          if (commissionCat) bp.category_id = commissionCat.id
          continue
        }
        if (BP_AMEX_PAY_RE.test(bp.description) && bp.type === 'expense') {
          if (bothLoaded) {
            const match = amexRows.find((ar) =>
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

      // — KNOWN_TRANSFER_PATTERNS: pre-imposta giroconto per pattern noti —
      for (const row of normalRows) {
        if (row.source !== 'bancoposta') continue
        for (const rule of KNOWN_TRANSFER_PATTERNS) {
          if (rule.pattern.test(row.description)) {
            const destAccount = accounts.find((a) => a.name === rule.destinationAccountName)
            if (destAccount) {
              row.type = 'transfer'
              row.destination_account_id = destAccount.id
              row.autoDetectedTransfer = true
              row.category_id = ''
            }
            break
          }
        }
      }

      // — Duplicate detection —
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
  }, [bpFile, amexFile, bpAccount, amexAccount, commissionCat, accounts, supabase])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setProgress(0)
    const toSave = rows.filter((r) => r.included)
    const total = toSave.length + transferPairs.length
    if (total === 0) { setSaving(false); return }
    let done = 0
    const failedRows: { desc: string; error: string }[] = []

    const post = async (body: Record<string, unknown>) => {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const p = await res.json().catch(() => ({}))
        throw new Error(typeof p.error === 'string' ? p.error : `HTTP ${res.status}`)
      }
    }

    for (const row of toSave) {
      try {
        if (row.type === 'transfer') {
          if (!row.destination_account_id) {
            failedRows.push({ desc: row.description || 'Giroconto', error: 'Conto destinazione mancante' })
          } else {
            await post({
              account_id: row.account_id,
              destination_account_id: row.destination_account_id,
              type: 'transfer',
              amount: row.amount,
              description: row.description || 'Giroconto',
              date: row.date,
            })
          }
        } else {
          await post({
            account_id: row.account_id,
            type: row.type,
            amount: row.amount,
            description: row.description || 'Movimento importato',
            date: row.date,
            category_id: row.category_id || null,
          })
        }
      } catch (e) {
        failedRows.push({ desc: row.description || '—', error: e instanceof Error ? e.message : 'Errore sconosciuto' })
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
      } catch (e) {
        failedRows.push({ desc: pair.bancRow.description || 'Coppia BP↔Amex', error: e instanceof Error ? e.message : 'Errore sconosciuto' })
      }
      setProgress(Math.round((++done / total) * 100))
    }

    setSaving(false)
    const imported = total - failedRows.length
    if (failedRows.length === 0) {
      toast.success(`${imported} operazioni importate con successo`)
      router.push('/transactions')
    } else {
      failedRows.forEach(({ desc, error }) =>
        toast.error(`"${desc.slice(0, 40)}" — ${error}`, { duration: 8000 }),
      )
      if (imported > 0) toast.success(`${imported} operazioni importate con successo`)
      // non reindirizza: l'utente vede gli errori e può riprovare
    }
  }, [rows, transferPairs, router])

  const updateRow = useCallback((id: string, patch: Partial<ParsedRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }, [])

  const toggleAll = useCallback((checked: boolean) => {
    setRows((prev) => prev.map((r) => (r.isDuplicate ? r : { ...r, included: checked })))
  }, [])

  const onTypeChange = useCallback((id: string, newType: RowType) => {
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r
      return {
        ...r,
        type: newType,
        autoDetectedTransfer: false,
        // switching to transfer: clear category; from transfer: clear destination
        ...(newType === 'transfer' ? { category_id: '' } : { destination_account_id: '' }),
      }
    }))
  }, [])

  // ─── render ──────────────────────────────────────────────────────────────────

  const allSelectableIncluded =
    rows.filter((r) => !r.isDuplicate).length > 0 &&
    rows.filter((r) => !r.isDuplicate).every((r) => r.included)

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">

        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-indigo-600">Importazione</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Importa estratti conto</h1>
            <p className="mt-1 text-sm text-slate-500">
              Bancoposta (.xlsx) e American Express (.csv) — rilevamento automatico trasferimenti e duplicati.
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
        <div className="flex items-center gap-2 text-sm">
          <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold', step === 'upload' ? 'bg-indigo-600 text-white' : 'bg-emerald-100 text-emerald-700')}>
            {step === 'upload' ? '1' : <CheckCircle2 className="h-3.5 w-3.5" />}
          </span>
          <span className={cn('font-medium', step === 'upload' ? 'text-slate-900' : 'text-slate-400')}>Carica file</span>
          <span className="h-px w-8 bg-slate-200" />
          <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold', step === 'preview' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400')}>2</span>
          <span className={cn('font-medium', step === 'preview' ? 'text-slate-900' : 'text-slate-400')}>Anteprima e conferma</span>
        </div>

        {/* ── UPLOAD STEP ── */}
        {step === 'upload' && (
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
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
            <Button onClick={handleParse} disabled={(!bpFile && !amexFile) || parsing} className="h-11 gap-2 px-8">
              {parsing ? 'Analisi in corso…' : 'Analizza e continua →'}
            </Button>
          </div>
        )}

        {/* ── PREVIEW STEP ── */}
        {step === 'preview' && (
          <div className="space-y-5">

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { label: 'Uscite', value: counts.expense, color: 'text-red-600' },
                { label: 'Entrate', value: counts.income, color: 'text-emerald-600' },
                { label: 'Giroconti manuali', value: counts.manualTransfers, color: 'text-indigo-600' },
                { label: 'Giroconti auto (BP↔Amex)', value: counts.autoTransfers, color: 'text-indigo-600' },
                { label: 'Duplicati esclusi', value: counts.duplicates, color: 'text-amber-600' },
              ].map(({ label, value, color }) => (
                <Card key={label} className="border-[#e5e7f0] bg-white shadow-sm">
                  <CardContent className="p-3">
                    <p className="text-[10px] font-medium text-slate-500">{label}</p>
                    <p className={cn('mt-0.5 text-xl font-bold tabular-nums', color)}>{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Auto-detected BP↔Amex transfer pairs */}
            {transferPairs.length > 0 && (
              <Card className="border-indigo-100 bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm text-indigo-700">
                    <ArrowLeftRight className="h-4 w-4" />
                    Giroconti rilevati automaticamente ({transferPairs.length}) — BP → Carta di Credito
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 pt-0">
                  {transferPairs.map((pair) => (
                    <div key={pair.id} className="flex items-center justify-between gap-4 rounded-lg border border-indigo-100 bg-indigo-50/40 px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{pair.bancRow.description}</p>
                        <p className="text-slate-400">BP {pair.bancRow.date} · Amex {pair.amexRow.date}</p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums text-indigo-700">{formatCurrency(pair.bancRow.amount)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Dense preview table */}
            <Card className="border-[#e5e7f0] bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  Movimenti da importare
                  <span className="ml-2 font-normal text-slate-400">
                    {rows.length} totali · {rows.filter((r) => r.included).length} selezionati
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {rows.length === 0 ? (
                  <p className="px-5 py-6 text-center text-sm text-slate-400">Nessun movimento normale da importare.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px]">
                      <thead className="border-b border-[#e5e7f0] bg-slate-50/80">
                        <tr>
                          <th className="px-3 py-2 text-left">
                            <input
                              type="checkbox"
                              checked={allSelectableIncluded}
                              onChange={(e) => toggleAll(e.target.checked)}
                              className="h-3.5 w-3.5 rounded border-slate-300 accent-indigo-600"
                              title="Seleziona tutti"
                            />
                          </th>
                          {['Fonte', 'Data', 'Descrizione', 'Importo', 'Tipo', 'Conto dest. / Categoria', ''].map((h) => (
                            <th key={h} className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0f1f5]">
                        {rows.map((row) => {
                          const otherAccounts = activeAccounts.filter((a) => a.id !== row.account_id)
                          const isTransfer = row.type === 'transfer'
                          const missingDest = isTransfer && !row.destination_account_id
                          return (
                            <tr
                              key={row.id}
                              className={cn(
                                'group text-xs transition-colors hover:bg-slate-50/60',
                                !row.included && 'opacity-40',
                                row.isDuplicate && 'bg-red-50/20',
                              )}
                            >
                              {/* checkbox */}
                              <td className="px-3 py-1.5">
                                <input
                                  type="checkbox"
                                  checked={row.included}
                                  disabled={row.isDuplicate}
                                  onChange={(e) => updateRow(row.id, { included: e.target.checked })}
                                  className="h-3.5 w-3.5 rounded border-slate-300 accent-indigo-600 disabled:cursor-not-allowed"
                                />
                              </td>

                              {/* fonte */}
                              <td className="px-2 py-1.5">
                                <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', row.source === 'bancoposta' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700')}>
                                  {row.source === 'bancoposta' ? 'BP' : 'Amex'}
                                </span>
                              </td>

                              {/* data */}
                              <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-slate-500">{row.date}</td>

                              {/* descrizione — input modificabile */}
                              <td className="px-2 py-1.5">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={row.description}
                                    onChange={(e) => updateRow(row.id, { description: e.target.value })}
                                    className="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-xs text-slate-900 placeholder:text-slate-300 hover:border-[#e5e7f0] focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                    placeholder="Descrizione"
                                  />
                                  {row.warning && (
                                    <span title={row.warning}>
                                      <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
                                    </span>
                                  )}
                                  {row.isDuplicate && (
                                    <span className="shrink-0 rounded bg-red-100 px-1 py-0.5 text-[9px] font-bold text-red-700">DUP</span>
                                  )}
                                </div>
                              </td>

                              {/* importo */}
                              <td className="whitespace-nowrap px-2 py-1.5 text-right">
                                <span className={cn('font-semibold tabular-nums', row.type === 'income' ? 'text-emerald-600' : row.type === 'expense' ? 'text-red-600' : 'text-indigo-600')}>
                                  {row.type === 'income' ? '+' : row.type === 'expense' ? '−' : '⇄'}{formatCurrency(row.amount)}
                                </span>
                              </td>

                              {/* tipo select */}
                              <td className="px-2 py-1.5">
                                <div className="flex items-center gap-1">
                                  <Sel value={row.type} onChange={(v) => onTypeChange(row.id, v as RowType)} className="w-24">
                                    <option value="expense">Spesa</option>
                                    <option value="income">Entrata</option>
                                    <option value="transfer">Giroconto</option>
                                  </Sel>
                                  {row.autoDetectedTransfer && (
                                    <span title="Rilevato automaticamente da pattern noto" className="flex items-center gap-0.5 rounded bg-indigo-50 px-1 py-0.5 text-[9px] font-bold text-indigo-600">
                                      <Zap className="h-2.5 w-2.5" />
                                      Auto
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* conto destinazione (transfer) o categoria (income/expense) */}
                              <td className="px-2 py-1.5">
                                {isTransfer ? (
                                  <Sel
                                    value={row.destination_account_id}
                                    onChange={(v) => updateRow(row.id, { destination_account_id: v })}
                                    className={cn('w-40', missingDest && 'border-amber-400 bg-amber-50')}
                                  >
                                    <option value="">— conto dest. —</option>
                                    {otherAccounts.map((a) => (
                                      <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                  </Sel>
                                ) : (
                                  <CategorySelect
                                    value={row.category_id}
                                    type={row.type}
                                    expenseCats={expenseCats}
                                    incomeCats={incomeCats}
                                    onChange={(id) => updateRow(row.id, { category_id: id })}
                                  />
                                )}
                              </td>

                              {/* flag cella vuota (reserved) */}
                              <td className="px-2 py-1.5" />
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Save bar */}
            <div className="flex items-center gap-4 pb-4">
              <Button
                onClick={handleSave}
                disabled={saving || counts.total === 0}
                className="h-11 gap-2 px-8"
              >
                {saving ? `Importazione… ${progress}%` : `Importa ${counts.total} operazioni selezionate`}
              </Button>
              {saving && (
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-indigo-500 transition-all duration-200" style={{ width: `${progress}%` }} />
                </div>
              )}
              {counts.total === 0 && !saving && (
                <p className="text-xs text-slate-400">Nessun movimento selezionato.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
