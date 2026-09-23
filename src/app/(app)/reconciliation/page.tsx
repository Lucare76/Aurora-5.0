'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, CheckCircle2, History } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageLoadingState } from '@/components/shared/PageState'
import { useAccounts } from '@/hooks/use-accounts'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency } from '@/lib/utils'
import {
  calculateReconciliationDifference,
  isReconciliationBalanced,
} from '@/domain/accounting/reconciliation'
import {
  createReconciliation,
  listReconciliationHistory,
  ReconciliationError,
} from '@/lib/reconciliation/service'
import type { AccountReconciliation } from '@/types/database'

const BORDER = '#e5e7f0'

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'h-11 w-full rounded-xl border bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100',
        props.className,
      )}
      style={{ borderColor: BORDER }}
    />
  )
}

function todayIso(): string {
  return new Date().toLocaleDateString('en-CA')
}

function getInitialAccountId(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('account') ?? ''
}

function statusBadge(status: AccountReconciliation['status']) {
  switch (status) {
    case 'reconciled': return { label: 'Riconciliato', tone: 'bg-emerald-50 text-emerald-700' }
    case 'mismatch': return { label: 'Differenza rilevata', tone: 'bg-amber-50 text-amber-700' }
    case 'superseded': return { label: 'Superata', tone: 'bg-slate-100 text-slate-500' }
    default: return { label: 'In attesa', tone: 'bg-slate-100 text-slate-500' }
  }
}

export default function ReconciliationPage() {
  const supabase = createClient()
  const { accounts, loading: accountsLoading } = useAccounts()

  const [accountId, setAccountId] = useState<string>(getInitialAccountId)
  const [statementDate, setStatementDate] = useState<string>(todayIso())
  const [bankBalanceInput, setBankBalanceInput] = useState<string>('')
  const [history, setHistory] = useState<AccountReconciliation[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const activeAccounts = useMemo(() => accounts.filter((a) => a.is_active), [accounts])
  const selectedAccount = useMemo(() => accounts.find((a) => a.id === accountId) ?? null, [accounts, accountId])

  useEffect(() => {
    if (!accountId && activeAccounts.length > 0) setAccountId(activeAccounts[0].id)
  }, [accountId, activeAccounts])

  useEffect(() => {
    if (!accountId) { setHistory([]); return }
    let cancelled = false
    setHistoryLoading(true)
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      try {
        const rows = await listReconciliationHistory(supabase, user.id, accountId)
        if (!cancelled) setHistory(rows)
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [supabase, accountId])

  const appBalanceSnapshot = selectedAccount ? Number(selectedAccount.balance) : 0
  const parsedBankBalance = bankBalanceInput.trim() === '' ? null : Number(bankBalanceInput.replace(',', '.'))
  const previewDifference = parsedBankBalance !== null && Number.isFinite(parsedBankBalance)
    ? calculateReconciliationDifference(parsedBankBalance, appBalanceSnapshot)
    : null
  const previewBalanced = previewDifference !== null ? isReconciliationBalanced(previewDifference) : null

  const handleSave = async () => {
    if (!selectedAccount || parsedBankBalance === null || !Number.isFinite(parsedBankBalance)) {
      toast.error('Inserisci un saldo banca valido')
      return
    }
    try {
      setSaving(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessione scaduta. Accedi di nuovo.')
      const reconciliation = await createReconciliation(supabase, user.id, {
        accountId: selectedAccount.id,
        statementDate,
        bankBalance: parsedBankBalance,
      })
      // Re-fetch rather than optimistically reordering client-side: a
      // retroactive statement_date does not make the new row "current", and
      // only the server (via listReconciliationHistory's statement_date-first
      // ordering) knows the true current/superseded state after the insert.
      const rows = await listReconciliationHistory(supabase, user.id, selectedAccount.id)
      setHistory(rows)
      setBankBalanceInput('')
      toast.success(reconciliation.status === 'reconciled' ? 'Conto riconciliato' : 'Riconciliazione salvata: differenza rilevata')
    } catch (error) {
      toast.error(error instanceof ReconciliationError ? error.message : 'Errore durante il salvataggio della riconciliazione')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24 sm:p-6">
      <div className="flex items-center gap-3">
        <Link href="/accounts">
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold text-slate-950">Riconciliazione conto</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Confronta con l&apos;estratto conto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-slate-700">Conto</Label>
              <SelectField value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={accountsLoading}>
                <option value="">Seleziona conto</option>
                {activeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </SelectField>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700">Data estratto conto</Label>
              <Input type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} className="h-11" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-slate-700">Saldo Aurora attuale</Label>
              <Input readOnly value={selectedAccount ? formatCurrency(appBalanceSnapshot, selectedAccount.currency) : '—'} className="h-11 bg-slate-50 text-slate-600" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700">Saldo da estratto banca</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={bankBalanceInput}
                onChange={(e) => setBankBalanceInput(e.target.value)}
                className="h-11"
              />
            </div>
          </div>

          {selectedAccount && ['investment', 'savings'].includes(selectedAccount.type) && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-3 text-xs leading-relaxed text-indigo-800">
              Se questo conto è collegato a una voce Poste nel Patrimonio, il valore reale inserito qui aggiorna anche il valore patrimoniale e il suo storico. Il saldo contabile del conto e la liquidità disponibile non vengono modificati.
            </div>
          )}

          {previewDifference !== null && (
            <div className={cn('rounded-2xl border p-4 text-sm', previewBalanced ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800')}>
              <div className="flex items-center gap-2 font-semibold">
                {previewBalanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {previewBalanced ? 'I saldi coincidono' : `Differenza di ${formatCurrency(previewDifference, selectedAccount?.currency ?? 'EUR')}`}
              </div>
              {!previewBalanced && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-700">
                  <li>Verifica se ci sono movimenti mancanti o non ancora registrati.</li>
                  <li>Controlla eventuali duplicati tra i movimenti recenti.</li>
                  <li>Controlla i giroconti e le importazioni recenti dall&apos;estratto conto.</li>
                  <li>Verifica i movimenti marcati come neutri (partite di giro).</li>
                  {selectedAccount && ['investment', 'savings'].includes(selectedAccount.type) && (
                    <li>Per buoni e investimenti, la differenza può essere rendimento maturato: se la voce Poste è collegata al Patrimonio, il valore reale verrà aggiornato lì senza creare un&apos;entrata.</li>
                  )}
                </ul>
              )}
            </div>
          )}

          <Button onClick={handleSave} disabled={saving || !selectedAccount || parsedBankBalance === null} className="h-11 w-full">
            {saving ? 'Salvataggio...' : 'Salva riconciliazione'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" /> Storico riconciliazioni</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <PageLoadingState label="Caricamento storico riconciliazioni…" rows={3} />
          ) : history.length === 0 ? (
            <EmptyState icon={History} title="Nessuna riconciliazione" description="Non è ancora stata registrata nessuna riconciliazione per questo conto." />
          ) : (
            <div className="divide-y" style={{ borderColor: BORDER }}>
              {history.map((row) => {
                const badge = statusBadge(row.status)
                return (
                  <div key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{new Date(`${row.statement_date}T00:00:00`).toLocaleDateString('it-IT')}</p>
                      <p className="text-xs text-slate-500">Banca {formatCurrency(Number(row.bank_balance))} · Aurora {formatCurrency(Number(row.app_balance_snapshot))}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium tabular-nums text-slate-600">{formatCurrency(Number(row.difference))}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', badge.tone)}>{badge.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
