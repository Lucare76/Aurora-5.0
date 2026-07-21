'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import type { Resolver, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Download, LogOut, RefreshCcw, Save, Settings, Trash2, User } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buildTransactionExportRows, buildTransactionsCsv } from '@/domain/accounting/export'
import { adaptTransactionRows } from '@/domain/accounting/transaction-adapter'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import type { Account, Category, Transaction } from '@/types/database'

const profileSchema = z.object({
  display_name: z.string().trim().min(1, 'Il nome è obbligatorio'),
  currency: z.enum(['EUR', 'USD', 'GBP', 'CHF']),
  timezone: z.string().trim().min(1, 'Il fuso orario è obbligatorio'),
})

type ProfileForm = z.infer<typeof profileSchema>

const TRANSACTION_SELECT = 'id,user_id,account_id,category_id,type,amount,description,notes,date,transfer_peer_id,recurring_id,receipt_url,receipt_data,created_at,updated_at'
const MAX_BACKUP_DRY_RUN_BYTES = 10 * 1024 * 1024
const RESTORE_CONFIRMATION_PHRASE = 'RIPRISTINA AURORA'
const REAL_RESTORE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_BACKUP_RESTORE_REAL === 'true'

type DryRunReport = {
  readiness: 'ready' | 'ready_with_warnings' | 'blocked'
  backup: {
    format: string
    schemaVersion: number | null
    createdAt: string | null
    checksumValid: boolean
  }
  currentState: {
    isEmpty: boolean
    blockingCollections: string[]
  } | null
  summary: {
    backupRecords: number
    creatableRecords: number
    collisions: number
    duplicates: number
    missingReferences: number
    blockingErrors: number
    warnings: number
  }
  accountingPreview: {
    totalIncome: number
    totalExpense: number
    netCashflow: number
    totalNetWorth: number
    transferCount: number
    transfersNeutral: boolean
  } | null
  restorePlan: Array<{
    sequence: number
    collection: string
    recordCount: number
    status: 'ready' | 'warning' | 'blocked'
  }>
  issues?: Array<{
    code: string
    severity: 'error' | 'warning' | 'info'
    path: Array<string | number>
    message: string
    details?: Record<string, string | number | boolean | null>
  }>
  logicalDuplicates?: Array<{
    collection: string
    key: string
    blocking: boolean
    message: string
  }>
  collisions?: Array<{
    collection: string
    id?: string
    kind: string
    blocking: boolean
    message: string
  }>
  missingReferences?: Array<{
    collection: string
    id: string
    reference: string
    code: string
    message: string
  }>
}

type RestorePreparation = {
  tokenId: string
  token: string
  expiresAt: string
  checksum: string
  requiredConfirmation: string
  summary: DryRunReport['summary']
  accountingPreview: NonNullable<DryRunReport['accountingPreview']>
}

type RestoreResult = {
  status: 'completed'
  restore: {
    restoreId: string
    counts: Record<string, number>
    verified: boolean
  }
  checksum: string
}

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'h-11 w-full rounded-xl border border-[#e5e7f0] bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100',
        props.className,
      )}
    />
  )
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string
  description: string
  icon: typeof Settings
  children: React.ReactNode
}) {
  return (
    <Card className="border-[#e5e7f0] bg-white shadow-sm">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-indigo-50 p-2 text-indigo-600">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg text-slate-950">{title}</CardTitle>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const db = supabase
  const { user, profile, signOut } = useAuth()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [backupFile, setBackupFile] = useState<File | null>(null)
  const [dryRunReport, setDryRunReport] = useState<DryRunReport | null>(null)
  const [restorePreparation, setRestorePreparation] = useState<RestorePreparation | null>(null)
  const [restoreConfirm, setRestoreConfirm] = useState('')
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null)
  const [restoreBusy, setRestoreBusy] = useState(false)

  const defaultTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])
  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema) as Resolver<ProfileForm>,
    values: {
      display_name: profile?.display_name ?? user?.email?.split('@')[0] ?? '',
      currency: (profile?.currency as ProfileForm['currency']) ?? 'EUR',
      timezone: profile?.timezone ?? defaultTimezone,
    },
  })

  const onSaveProfile: SubmitHandler<ProfileForm> = async (values) => {
    if (!user) return
    try {
      setBusy(true)
      const { error } = await db
        .from('profiles')
        .upsert({
          id: user.id,
          display_name: values.display_name,
          avatar_url: profile?.avatar_url ?? null,
          currency: values.currency,
          locale: profile?.locale ?? 'it-IT',
          timezone: values.timezone,
          onboarding_done: profile?.onboarding_done ?? false,
        })
      if (error) throw error
      toast.success('Profilo salvato')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante il salvataggio')
    } finally {
      setBusy(false)
    }
  }

  const regenerateCategories = async () => {
    if (!user) return
    try {
      setBusy(true)
      const { error } = await db.rpc('create_default_categories', { p_user_id: user.id })
      if (error) throw error
      toast.success('Categorie default rigenerate')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante la rigenerazione')
    } finally {
      setBusy(false)
    }
  }

  const exportTransactions = async () => {
    try {
      const [txRes, catRes, accRes] = await Promise.all([
        db.from('transactions').select(TRANSACTION_SELECT).order('date', { ascending: false }).order('created_at', { ascending: false }),
        db.from('categories').select('id,name'),
        db.from('accounts').select('id,name,user_id'),
      ])
      if (txRes.error) throw txRes.error

      const transactions = (txRes.data ?? []) as Transaction[]
      const accounts = (accRes.data ?? []) as Pick<Account, 'id' | 'name' | 'user_id'>[]
      const categories = (catRes.data ?? []) as Pick<Category, 'id' | 'name'>[]
      const appTransactions = adaptTransactionRows(transactions, {
        accounts: accounts as Account[],
        peerTransactions: transactions,
      })
      const rows = buildTransactionExportRows(appTransactions, categories, accounts)
      const csv = buildTransactionsCsv(rows)
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `aurora-transazioni-${new Date().toLocaleDateString('en-CA')}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('CSV esportato')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante l\'esportazione')
    }
  }

  const exportBackup = async () => {
    try {
      setBusy(true)
      const response = await fetch('/api/backup/export', {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(payload?.error ?? 'Non è stato possibile creare il backup')
      }

      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition')
      const filename = disposition?.match(/filename="([^"]+)"/)?.[1] ?? `aurora-backup-v1-${new Date().toLocaleDateString('en-CA')}.json`
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Backup Aurora verificato scaricato')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante la creazione del backup')
    } finally {
      setBusy(false)
    }
  }

  const verifyBackup = async () => {
    if (!backupFile) {
      toast.error('Seleziona un file backup JSON')
      return
    }
    if (!backupFile.name.toLowerCase().endsWith('.json')) {
      toast.error('Sono accettati solo file .json')
      return
    }
    if (backupFile.size > MAX_BACKUP_DRY_RUN_BYTES) {
      toast.error('File troppo grande. Il limite massimo è 10 MB.')
      return
    }

    try {
      setBusy(true)
      setDryRunReport(null)
      setRestorePreparation(null)
      setRestoreResult(null)
      setRestoreConfirm('')
      const content = await backupFile.text()
      const response = await fetch('/api/backup/restore/dry-run', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: backupFile.name, content }),
      })
      const payload = await response.json() as DryRunReport | { error?: string }

      if (!response.ok) {
        throw new Error('error' in payload ? payload.error : 'Errore durante la verifica')
      }

      setDryRunReport(payload as DryRunReport)
      toast.success('Simulazione completata. Nessun dato è stato modificato.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante la verifica del backup')
    } finally {
      setBusy(false)
    }
  }

  const prepareRestore = async () => {
    if (!backupFile || dryRunReport?.readiness !== 'ready') return
    if (!REAL_RESTORE_ENABLED) {
      toast.error('Ripristino reale non ancora abilitato: manca la validazione DB/RPC finale.')
      return
    }
    try {
      setRestoreBusy(true)
      setRestorePreparation(null)
      setRestoreResult(null)
      const content = await backupFile.text()
      const response = await fetch('/api/backup/restore/prepare', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: backupFile.name, content }),
      })
      const payload = await response.json() as RestorePreparation | { error?: string }
      if (!response.ok) throw new Error('error' in payload ? restoreErrorMessage(payload.error) : 'Preparazione non riuscita')
      setRestorePreparation(payload as RestorePreparation)
      toast.success('Conferma pronta per 5 minuti')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante la preparazione del ripristino')
    } finally {
      setRestoreBusy(false)
    }
  }

  const restoreBackup = async () => {
    if (!backupFile || !restorePreparation || restoreConfirm !== RESTORE_CONFIRMATION_PHRASE) return
    try {
      setRestoreBusy(true)
      const content = await backupFile.text()
      const response = await fetch('/api/backup/restore', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: backupFile.name,
          content,
          tokenId: restorePreparation.tokenId,
          token: restorePreparation.token,
          confirmation: restoreConfirm,
        }),
      })
      const payload = await response.json() as RestoreResult | { error?: string }
      if (!response.ok) throw new Error('error' in payload ? restoreErrorMessage(payload.error) : 'Ripristino non riuscito')
      setRestoreResult(payload as RestoreResult)
      setRestorePreparation(null)
      setRestoreConfirm('')
      toast.success('Ripristino completato e verificato')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Il ripristino non è stato completato')
    } finally {
      setRestoreBusy(false)
    }
  }

  const confirmLogout = async () => {
    try {
      await signOut()
      window.location.href = '/login'
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante il logout')
    }
  }

  const deleteAccount = async () => {
    if (!user || deleteConfirm !== 'ELIMINA') return
    try {
      setBusy(true)
      const { error } = await db.rpc('delete_user_account', { p_user_id: user.id })
      if (error) throw error
      toast.success('Account eliminato')
      await signOut()
      window.location.href = '/login'
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Eliminazione non disponibile: configura la RPC delete_user_account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-950">
      <div className="mx-auto max-w-5xl space-y-7">
        <header>
          <p className="text-sm font-medium text-indigo-600">Preferenze</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Impostazioni</h1>
        </header>

        <SectionCard title="Profilo" description="Aggiorna nome, valuta preferita e fuso orario." icon={User}>
          <form onSubmit={form.handleSubmit(onSaveProfile)} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-1">
                <Label>Nome visualizzato</Label>
                <Input {...form.register('display_name')} className="h-11 border-[#e5e7f0] bg-white text-slate-950" />
              </div>
              <div className="space-y-2">
                <Label>Valuta preferita</Label>
                <SelectField {...form.register('currency')}>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="CHF">CHF</option>
                </SelectField>
              </div>
              <div className="space-y-2">
                <Label>Fuso orario</Label>
                <Input {...form.register('timezone')} className="h-11 border-[#e5e7f0] bg-white text-slate-950" />
              </div>
            </div>
            <Button type="submit" className="gap-2" disabled={busy || form.formState.isSubmitting}>
              <Save className="h-4 w-4" />
              Salva profilo
            </Button>
          </form>
        </SectionCard>

        <SectionCard title="Categorie default" description="Rigenera le categorie base se risultano mancanti." icon={RefreshCcw}>
          <Button variant="outline" className="gap-2" onClick={regenerateCategories} disabled={busy}>
            <RefreshCcw className="h-4 w-4" />
            Rigenera categorie default
          </Button>
        </SectionCard>

        <SectionCard title="Dati" description="Esporta le transazioni in formato CSV." icon={Download}>
          <Button variant="outline" className="gap-2" onClick={exportTransactions}>
            <Download className="h-4 w-4" />
            Esporta transazioni CSV
          </Button>
        </SectionCard>

        <SectionCard title="Backup completo Aurora" description="Scarica un file JSON versionato e verificato per un futuro ripristino." icon={Download}>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Contiene i dati necessari per un futuro ripristino. Conserva il file in un luogo sicuro.
            </p>
            <Button variant="outline" className="gap-2" onClick={exportBackup} disabled={busy}>
              <Download className="h-4 w-4" />
              {busy ? 'Preparazione backup...' : 'Scarica backup completo Aurora'}
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Verifica un backup" description="Controlla il contenuto e simula il ripristino senza modificare i dati." icon={Download}>
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label>File backup JSON</Label>
                <Input
                  type="file"
                  accept="application/json,.json"
                  className="h-11 border-[#e5e7f0] bg-white text-slate-950"
                  onChange={(event) => {
                    setBackupFile(event.target.files?.[0] ?? null)
                    setDryRunReport(null)
                    setRestorePreparation(null)
                    setRestoreResult(null)
                    setRestoreConfirm('')
                  }}
                  disabled={restoreBusy}
                />
                {backupFile ? (
                  <p className="text-xs text-slate-500">
                    {backupFile.name} - {(backupFile.size / 1024).toFixed(1)} KB
                  </p>
                ) : null}
              </div>
              <div className="flex items-end">
                <Button variant="outline" className="w-full gap-2 md:w-auto" onClick={verifyBackup} disabled={busy || restoreBusy || !backupFile}>
                  <Download className="h-4 w-4" />
                  {busy ? 'Verifica in corso...' : 'Verifica backup'}
                </Button>
              </div>
            </div>

            {dryRunReport ? (
              <div className="rounded-2xl border border-[#e5e7f0] bg-[#f8f9fc] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {dryRunReport.readiness === 'ready'
                        ? 'Il backup è pronto per un futuro ripristino.'
                        : dryRunReport.readiness === 'ready_with_warnings'
                          ? 'Il file è integro ma presenta avvisi.'
                          : 'Il backup non è ripristinabile nelle condizioni attuali.'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Simulazione completata. Nessun dato è stato modificato.</p>
                  </div>
                  <span className={cn(
                    'rounded-full px-3 py-1 text-xs font-semibold',
                    dryRunReport.readiness === 'ready' && 'bg-emerald-50 text-emerald-700',
                    dryRunReport.readiness === 'ready_with_warnings' && 'bg-amber-50 text-amber-700',
                    dryRunReport.readiness === 'blocked' && 'bg-red-50 text-red-700',
                  )}>
                    {dryRunReport.readiness}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <ReportMetric label="Versione" value={String(dryRunReport.backup.schemaVersion ?? '-')} />
                  <ReportMetric label="Checksum" value={dryRunReport.backup.checksumValid ? 'Valido' : 'Non valido'} />
                  <ReportMetric label="Account vuoto" value={dryRunReport.currentState?.isEmpty ? 'Sì' : 'No'} />
                  <ReportMetric label="Record" value={String(dryRunReport.summary.backupRecords)} />
                  <ReportMetric label="Creabili" value={String(dryRunReport.summary.creatableRecords)} />
                  <ReportMetric label="Collisioni" value={String(dryRunReport.summary.collisions)} />
                  <ReportMetric label="Duplicati" value={String(dryRunReport.summary.duplicates)} />
                  <ReportMetric label="Errori" value={String(dryRunReport.summary.blockingErrors)} />
                </div>

                {dryRunReport.accountingPreview ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <ReportMetric label="Entrate previste" value={`${dryRunReport.accountingPreview.totalIncome.toFixed(2)} €`} />
                    <ReportMetric label="Uscite previste" value={`${dryRunReport.accountingPreview.totalExpense.toFixed(2)} €`} />
                    <ReportMetric label="Patrimonio previsto" value={`${dryRunReport.accountingPreview.totalNetWorth.toFixed(2)} €`} />
                    <ReportMetric label="Trasferimenti" value={`${dryRunReport.accountingPreview.transferCount} ${dryRunReport.accountingPreview.transfersNeutral ? 'neutrali' : 'da verificare'}`} />
                  </div>
                ) : null}

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Piano sintetico</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {dryRunReport.restorePlan.slice(0, 8).map((step) => (
                      <div key={`${step.sequence}-${step.collection}`} className="flex items-center justify-between rounded-xl border border-[#e5e7f0] bg-white px-3 py-2 text-xs">
                        <span>{step.sequence}. {step.collection}</span>
                        <span className="font-medium text-slate-500">{step.recordCount} - {step.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <DryRunDetailPanel report={dryRunReport} />

                {dryRunReport.currentState && dryRunReport.currentState.blockingCollections.length > 0 ? (
                  <p className="mt-4 text-sm text-red-600">L’account contiene già dati: {dryRunReport.currentState.blockingCollections.join(', ')}.</p>
                ) : null}

                {dryRunReport.readiness === 'ready' ? (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-900">
                      {REAL_RESTORE_ENABLED ? 'Ripristino reale disponibile solo su account vuoto' : 'Ripristino reale non ancora abilitato'}
                    </p>
                    <p className="mt-1 text-sm text-amber-800">
                      {REAL_RESTORE_ENABLED
                        ? 'Il ripristino inserirà i dati presenti nel backup. In caso di errore l’operazione verrà annullata integralmente.'
                        : 'La verifica è pronta, ma il ripristino reale resterà disabilitato finché rollback e concorrenza non saranno provati su database locale o staging.'}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button variant="outline" onClick={prepareRestore} disabled={!REAL_RESTORE_ENABLED || restoreBusy || Boolean(restorePreparation)}>
                        {restoreBusy ? 'Preparazione...' : 'Prepara conferma'}
                      </Button>
                    </div>

                    {restorePreparation ? (
                      <div className="mt-4 space-y-3">
                        <div className="grid gap-3 md:grid-cols-3">
                          <ReportMetric label="Checksum" value={`${restorePreparation.checksum.slice(0, 18)}...`} />
                          <ReportMetric label="Scadenza" value={new Date(restorePreparation.expiresAt).toLocaleTimeString('it-IT')} />
                          <ReportMetric label="Frase richiesta" value={restorePreparation.requiredConfirmation} />
                        </div>
                        <div className="space-y-2">
                          <Label>Digita RIPRISTINA AURORA</Label>
                          <Input
                            value={restoreConfirm}
                            onChange={(event) => setRestoreConfirm(event.target.value)}
                            className="h-11 border-[#e5e7f0] bg-white text-slate-950"
                            disabled={restoreBusy}
                          />
                        </div>
                        <Button
                          variant="destructive"
                          onClick={restoreBackup}
                          disabled={restoreBusy || restoreConfirm !== RESTORE_CONFIRMATION_PHRASE}
                        >
                          {restoreBusy ? 'Ripristino...' : 'Ripristina backup'}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {restoreResult ? (
                  <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-emerald-900">Ripristino completato e verificato.</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-4">
                      <ReportMetric label="Restore ID" value={`${restoreResult.restore.restoreId.slice(0, 8)}...`} />
                      <ReportMetric label="Stato integrità" value={restoreResult.restore.verified ? 'Verificato' : 'Da verificare'} />
                      <ReportMetric label="Conti" value={String(restoreResult.restore.counts.accounts ?? 0)} />
                      <ReportMetric label="Transazioni" value={String(restoreResult.restore.counts.transactions ?? 0)} />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Account" description="Gestisci sessione e cancellazione account." icon={Settings}>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2" onClick={() => setLogoutOpen(true)}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
            <Button variant="destructive" className="gap-2" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
              Elimina account
            </Button>
          </div>
        </SectionCard>
      </div>

      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="max-w-md border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader><DialogTitle>Conferma logout</DialogTitle></DialogHeader>
          <p className="mt-4 text-sm text-slate-600">Vuoi uscire dal tuo account?</p>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setLogoutOpen(false)}>Annulla</Button>
            <Button onClick={confirmLogout}>Esci</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader><DialogTitle>Elimina account</DialogTitle></DialogHeader>
          <div className="mt-4 space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              Questa azione è definitiva. Per confermare scrivi <span className="font-semibold text-slate-950">ELIMINA</span>.
            </p>
            <Input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} className="h-11 border-[#e5e7f0] bg-white text-slate-950" />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>Annulla</Button>
              <Button variant="destructive" onClick={deleteAccount} disabled={deleteConfirm !== 'ELIMINA' || busy}>Elimina definitivamente</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e5e7f0] bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  )
}

const DUPE_CODES = new Set(['RESTORE_LOGICAL_DUPLICATE', 'RESTORE_ID_COLLISION', 'RESTORE_DUPLICATE'])

function DryRunDetailPanel({ report }: { report: DryRunReport }) {
  const issues = report.issues ?? []
  const logicalDuplicates = report.logicalDuplicates ?? []
  const collisions = report.collisions ?? []

  const blockingErrors = issues.filter((i) => i.severity === 'error' && !DUPE_CODES.has(i.code))
  const warnings = issues.filter((i) => i.severity === 'warning' && !DUPE_CODES.has(i.code))

  if (blockingErrors.length === 0 && logicalDuplicates.length === 0 && collisions.length === 0 && warnings.length === 0) {
    return null
  }

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dettaglio problemi</p>

      {blockingErrors.length > 0 && (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs font-medium text-red-600">Errori bloccanti ({blockingErrors.length})</p>
          {blockingErrors.map((issue, i) => (
            <div key={i} className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs">
              <span className="font-mono font-semibold text-red-700">{issue.code}</span>
              <span className="mx-1.5 text-red-300">·</span>
              <span className="text-slate-500">{issue.path.join('.')}</span>
              <p className="mt-0.5 text-slate-700">{issue.message}</p>
            </div>
          ))}
        </div>
      )}

      {logicalDuplicates.length > 0 && (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs font-medium text-amber-600">Duplicati logici ({logicalDuplicates.length})</p>
          {logicalDuplicates.map((dup, i) => (
            <div key={i} className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs">
              <span className="font-semibold text-amber-800">{dup.collection}</span>
              <span className="mx-1.5 text-amber-400">·</span>
              <span className="break-all font-mono text-slate-500">{dup.key}</span>
              <p className="mt-0.5 text-slate-700">{dup.message}</p>
            </div>
          ))}
        </div>
      )}

      {collisions.length > 0 && (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs font-medium text-orange-600">Collisioni UUID ({collisions.length})</p>
          {collisions.map((col, i) => (
            <div key={i} className="rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-xs">
              <span className="font-semibold text-orange-800">{col.collection}</span>
              {col.id ? (
                <>
                  <span className="mx-1.5 text-orange-400">·</span>
                  <span className="font-mono text-slate-500">{col.id}</span>
                </>
              ) : null}
              <p className="mt-0.5 text-slate-700">{col.message}</p>
            </div>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Avvisi ({warnings.length})</p>
          {warnings.map((issue, i) => (
            <div key={i} className="rounded-xl border border-[#e5e7f0] bg-white px-3 py-2 text-xs">
              <span className="font-mono font-semibold text-slate-600">{issue.code}</span>
              <span className="mx-1.5 text-slate-300">·</span>
              <span className="text-slate-500">{issue.path.join('.')}</span>
              <p className="mt-0.5 text-slate-600">{issue.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function restoreErrorMessage(code?: string) {
  switch (code) {
    case 'UNAUTHENTICATED':
      return 'Sessione scaduta. Effettua di nuovo il login.'
    case 'RESTORE_NOT_READY':
      return 'Il backup non è pronto per il ripristino reale.'
    case 'CONFIRMATION_REQUIRED':
      return 'Conferma testuale richiesta.'
    case 'TOKEN_INVALID':
      return 'Token di conferma non valido.'
    case 'TOKEN_EXPIRED':
      return 'Token di conferma scaduto.'
    case 'TOKEN_ALREADY_USED':
      return 'Token di conferma già utilizzato.'
    case 'ACCOUNT_NOT_EMPTY':
      return 'L’account contiene già dati.'
    case 'ACCOUNTING_MISMATCH':
      return 'Verifica contabile non superata.'
    case 'RESTORE_ROLLED_BACK':
      return 'Il ripristino non è stato completato. L’operazione è stata annullata e non dovrebbe essere stato conservato alcun dato parziale.'
    case 'RESTORE_DISABLED':
      return 'Ripristino reale non ancora abilitato: manca la validazione DB/RPC finale.'
    default:
      return 'Errore durante il ripristino.'
  }
}
