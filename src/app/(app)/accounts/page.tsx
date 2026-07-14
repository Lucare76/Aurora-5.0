'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Trash2,
  Upload,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/EmptyState'
import { useAccounts } from '@/hooks/use-accounts'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency } from '@/lib/utils'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, type AccountType } from '@/lib/constants'
import type { Account } from '@/types/database'

const BORDER = '#e5e7f0'

// ─── schema ───────────────────────────────────────────────────────────────────

const accountSchema = z.object({
  name: z.string().trim().min(1, 'Il nome è obbligatorio'),
  type: z.enum(ACCOUNT_TYPES),
  balance: z.coerce.number({ error: 'Inserisci un saldo valido' }),
  currency: z.string().trim().min(3, 'Inserisci una valuta valida').max(3, 'Usa il codice ISO a 3 lettere'),
  color: z.string().trim().min(1, 'Scegli un colore'),
})

type AccountForm = z.infer<typeof accountSchema>

const defaultValues: AccountForm = {
  name: '',
  type: 'checking',
  balance: 0,
  currency: 'EUR',
  color: '#6366f1',
}

const accountTypeOptions = ACCOUNT_TYPES.map((type) => ({
  value: type,
  label: ACCOUNT_TYPE_LABELS[type],
}))

const colorOptions = ['#6366f1', '#10b981', '#06b6d4', '#f59e0b', '#ef4444', '#8b5cf6']

// ─── helpers ──────────────────────────────────────────────────────────────────

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

type SortField = 'name' | 'balance'
type SortDir = 'asc' | 'desc'

function SortIcon({ field, active, dir }: { field: SortField; active: SortField; dir: SortDir }) {
  if (field !== active) return <ArrowUpDown className="ml-1 inline h-3 w-3 text-slate-300" />
  return dir === 'asc'
    ? <ChevronUp className="ml-1 inline h-3 w-3 text-indigo-500" />
    : <ChevronDown className="ml-1 inline h-3 w-3 text-indigo-500" />
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function AccountSkeleton() {
  return (
    <Card className="border-[#e5e7f0] bg-white shadow-sm">
      <CardContent className="p-0">
        <div className="divide-y divide-[#f0f1f5]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="h-3 w-3 animate-pulse rounded-full bg-slate-200" />
              <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
              <div className="ml-auto h-4 w-20 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const supabase = createClient()
  const db = supabase
  const { accounts, totalBalance, loading, refetch } = useAccounts()

  const [createOpen, setCreateOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [showHidden, setShowHidden] = useState(false)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('aurora-hidden-accounts')
      return new Set(stored ? (JSON.parse(stored) as string[]) : [])
    } catch { return new Set<string>() }
  })

  const activeCount = useMemo(() => accounts.filter((a) => a.is_active).length, [accounts])
  const hiddenCount = useMemo(() => accounts.filter((a) => hiddenIds.has(a.id)).length, [accounts, hiddenIds])

  const sorted = useMemo(() => {
    const base = showHidden ? accounts : accounts.filter((a) => !hiddenIds.has(a.id))
    return [...base].sort((a, b) => {
      const cmp = sortField === 'balance'
        ? a.balance - b.balance
        : a.name.localeCompare(b.name, 'it')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [accounts, sortField, sortDir, hiddenIds, showHidden])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir('desc') }
  }

  const toggleHide = (id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try { localStorage.setItem('aurora-hidden-accounts', JSON.stringify([...next])) } catch { /* noop */ }
      return next
    })
    setOpenMenuId(null)
  }

  const createForm = useForm<AccountForm>({
    resolver: zodResolver(accountSchema) as Resolver<AccountForm>,
    defaultValues,
  })

  const editForm = useForm<AccountForm>({
    resolver: zodResolver(accountSchema) as Resolver<AccountForm>,
    defaultValues,
  })

  const openEditDialog = (account: Account) => {
    setOpenMenuId(null)
    setEditingAccount(account)
    editForm.reset({
      name: account.name,
      type: account.type,
      balance: account.balance,
      currency: account.currency,
      color: account.color ?? '#6366f1',
    })
  }

  const onCreate: SubmitHandler<AccountForm> = async (values) => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Sessione scaduta. Accedi di nuovo.')
      const { error } = await db.from('accounts').insert({
        user_id: user.id,
        name: values.name,
        type: values.type,
        color: values.color,
        icon: null,
        balance: values.balance,
        currency: values.currency.toUpperCase(),
        is_active: true,
        sort_order: accounts.length,
      })
      if (error) throw error
      toast.success('Conto creato con successo')
      createForm.reset(defaultValues)
      setCreateOpen(false)
      await refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante la creazione del conto')
    }
  }

  const onEdit: SubmitHandler<AccountForm> = async (values) => {
    if (!editingAccount) return
    try {
      const { error } = await db
        .from('accounts')
        .update({ name: values.name, type: values.type, color: values.color, currency: values.currency.toUpperCase() })
        .eq('id', editingAccount.id)
      if (error) throw error
      toast.success('Conto aggiornato')
      setEditingAccount(null)
      await refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante la modifica del conto')
    }
  }

  const toggleAccount = async (account: Account) => {
    try {
      setBusyId(account.id)
      const { error } = await db.from('accounts').update({ is_active: !account.is_active }).eq('id', account.id)
      if (error) throw error
      toast.success(account.is_active ? 'Conto disattivato' : 'Conto riattivato')
      await refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante l’aggiornamento del conto')
    } finally {
      setBusyId(null)
      setOpenMenuId(null)
    }
  }

  const deleteAccount = async () => {
    if (!deletingAccount) return
    try {
      setBusyId(deletingAccount.id)
      const { error } = await db.from('accounts').delete().eq('id', deletingAccount.id)
      if (error) throw error
      toast.success('Conto eliminato')
      setDeletingAccount(null)
      await refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante l’eliminazione del conto')
    } finally {
      setBusyId(null)
    }
  }

  const renderForm = (
    form: typeof createForm,
    submitLabel: string,
    onSubmit: SubmitHandler<AccountForm>,
    isEdit = false,
  ) => (
    <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-5">
      <div className="space-y-2">
        <Label className="text-slate-700">Nome</Label>
        <Input
          {...form.register('name')}
          placeholder="Es. Conto principale"
          className="h-11 border-[#e5e7f0] bg-white text-slate-900 placeholder:text-slate-400"
        />
        {form.formState.errors.name && (
          <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-slate-700">Tipo</Label>
          <SelectField {...form.register('type')}>
            {accountTypeOptions.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </SelectField>
        </div>
        <div className="space-y-2">
          <Label className="text-slate-700">Valuta</Label>
          <Input
            {...form.register('currency')}
            className="h-11 uppercase border-[#e5e7f0] bg-white text-slate-900 placeholder:text-slate-400"
          />
          {form.formState.errors.currency && (
            <p className="text-sm text-red-600">{form.formState.errors.currency.message}</p>
          )}
        </div>
      </div>

      {!isEdit && (
        <div className="space-y-2">
          <Label className="text-slate-700">Saldo iniziale</Label>
          <Input
            type="number"
            step="0.01"
            inputMode="decimal"
            {...form.register('balance')}
            className="h-14 border-[#e5e7f0] bg-white text-2xl font-semibold tabular-nums text-slate-950 placeholder:text-slate-300"
          />
          {form.formState.errors.balance && (
            <p className="text-sm text-red-600">{form.formState.errors.balance.message}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-slate-700">Colore</Label>
        <div className="flex flex-wrap gap-2">
          {colorOptions.map((color) => (
            <button
              key={color}
              type="button"
              className={cn(
                'h-9 w-9 rounded-full border-4 border-white shadow ring-1 ring-slate-200 transition hover:scale-105',
                form.watch('color') === color && 'ring-2 ring-indigo-500',
              )}
              style={{ backgroundColor: color }}
              onClick={() => form.setValue('color', color, { shouldValidate: true })}
              aria-label={`Colore ${color}`}
            />
          ))}
        </div>
      </div>

      <Button type="submit" className="h-12 w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Salvataggio...' : submitLabel}
      </Button>
    </form>
  )

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-950">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Header */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-indigo-600">Patrimonio</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Conti</h1>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="h-11 gap-2 self-start sm:self-auto">
            <Plus className="h-4 w-4" />
            Nuovo conto
          </Button>
        </header>

        {/* Saldo totale */}
        <section className="overflow-hidden rounded-3xl border border-[#e5e7f0] bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-6 shadow-xl shadow-indigo-100/40 sm:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-1 text-xs font-semibold text-indigo-600">
                <Wallet className="h-3.5 w-3.5" />
                Saldo totale
              </div>
              <p className="mt-6 text-5xl font-semibold tracking-tight tabular-nums text-slate-950">
                {formatCurrency(totalBalance)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:min-w-64">
              <div className="rounded-2xl border border-white bg-white/75 p-4 shadow-sm">
                <p className="text-xs text-slate-500">Totali</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{accounts.length}</p>
              </div>
              <div className="rounded-2xl border border-white bg-white/75 p-4 shadow-sm">
                <p className="text-xs text-slate-500">Attivi</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-indigo-600">{activeCount}</p>
              </div>
            </div>
          </div>
        </section>

        {/* backdrop click-fuori per chiudere menu ⋯ */}
        {openMenuId && (
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpenMenuId(null)}
            aria-hidden
          />
        )}

        {/* Account list */}
        {loading ? (
          <AccountSkeleton />
        ) : accounts.length === 0 ? (
          <Card className="border-[#e5e7f0] bg-white shadow-sm">
            <CardContent className="p-8">
              <EmptyState
                icon={Wallet}
                title="Nessun conto"
                description="Crea il tuo primo conto per iniziare a monitorare saldo e movimenti."
                action={
                  <Button onClick={() => setCreateOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Aggiungi conto
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <>
            {hiddenCount > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowHidden((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e7f0] bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-700"
                >
                  {showHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showHidden
                    ? `Nascondi (${hiddenCount} nascosti)`
                    : `Mostra nascosti (${hiddenCount})`}
                </button>
              </div>
            )}
          <Card className="overflow-hidden border-[#e5e7f0] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead className="border-b border-[#e5e7f0] bg-slate-50/80">
                  <tr>
                    <th className="px-4 py-2.5 text-left">
                      <button
                        className="inline-flex items-center text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-700"
                        onClick={() => toggleSort('name')}
                      >
                        Conto
                        <SortIcon field="name" active={sortField} dir={sortDir} />
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tipo</th>
                    <th className="px-3 py-2.5 text-right">
                      <button
                        className="inline-flex items-center text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-700"
                        onClick={() => toggleSort('balance')}
                      >
                        Saldo
                        <SortIcon field="balance" active={sortField} dir={sortDir} />
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Stato</th>
                    <th className="w-20 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f1f5]">
                  {sorted.map((account) => {
                    const canImport = account.name === 'Bancoposta' || account.name === 'Carta di Credito'
                    const isHidden = hiddenIds.has(account.id)
                    return (
                      <tr
                        key={account.id}
                        className={cn(
                          'group text-sm transition-colors hover:bg-slate-50/60',
                          !account.is_active && 'opacity-50',
                          isHidden && 'opacity-40 italic',
                        )}
                      >
                        {/* Nome */}
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: account.color ?? '#6366f1' }}
                            />
                            <span className="font-medium text-slate-900">{account.name}</span>
                            <span className="text-xs text-slate-400">{account.currency}</span>
                          </div>
                        </td>

                        {/* Tipo */}
                        <td className="px-3 py-2.5">
                          <span className="rounded-full border border-[#e5e7f0] bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {ACCOUNT_TYPE_LABELS[account.type as AccountType] ?? account.type}
                          </span>
                        </td>

                        {/* Saldo */}
                        <td className="px-3 py-2.5 text-right">
                          <span className={cn(
                            'font-semibold tabular-nums',
                            account.balance >= 0 ? 'text-slate-900' : 'text-red-600',
                          )}>
                            {formatCurrency(account.balance, account.currency)}
                          </span>
                        </td>

                        {/* Stato */}
                        <td className="px-3 py-2.5">
                          <span className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                            account.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
                          )}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', account.is_active ? 'bg-emerald-500' : 'bg-slate-400')} />
                            {account.is_active ? 'Attivo' : 'Inattivo'}
                          </span>
                        </td>

                        {/* Azioni */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            {canImport && (
                              <Link href="/import-estratti">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-slate-400 hover:text-indigo-600"
                                  title="Importa estratto conto"
                                >
                                  <Upload className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                            )}
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-slate-700"
                                onClick={() => setOpenMenuId(openMenuId === account.id ? null : account.id)}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                              {openMenuId === account.id && (
                                <div className="absolute right-0 top-8 z-20 w-40 rounded-xl border border-[#e5e7f0] bg-white p-1 shadow-xl shadow-slate-200">
                                  <button
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                    onClick={() => openEditDialog(account)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    Modifica
                                  </button>
                                  <button
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                    onClick={() => toggleAccount(account)}
                                    disabled={busyId === account.id}
                                  >
                                    <Power className="h-3.5 w-3.5" />
                                    {account.is_active ? 'Disattiva' : 'Riattiva'}
                                  </button>
                                  <button
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                    onClick={() => toggleHide(account.id)}
                                  >
                                    {hiddenIds.has(account.id)
                                      ? <><Eye className="h-3.5 w-3.5" />Mostra</>
                                      : <><EyeOff className="h-3.5 w-3.5" />Nascondi</>}
                                  </button>
                                  <button
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                    onClick={() => { setOpenMenuId(null); setDeletingAccount(account) }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Elimina
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          </>
        )}
      </div>

      {/* Dialog: nuovo conto */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>Nuovo conto</DialogTitle>
          </DialogHeader>
          {renderForm(createForm, 'Crea conto', onCreate)}
        </DialogContent>
      </Dialog>

      {/* Dialog: modifica conto */}
      <Dialog open={Boolean(editingAccount)} onOpenChange={(open) => !open && setEditingAccount(null)}>
        <DialogContent className="max-w-xl border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>Modifica conto</DialogTitle>
          </DialogHeader>
          {renderForm(editForm, 'Salva modifiche', onEdit, true)}
        </DialogContent>
      </Dialog>

      {/* Dialog: elimina conto */}
      <Dialog open={Boolean(deletingAccount)} onOpenChange={(open) => !open && setDeletingAccount(null)}>
        <DialogContent className="max-w-md border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>Elimina conto</DialogTitle>
          </DialogHeader>
          <div className="mt-5 space-y-5">
            <p className="text-sm leading-6 text-slate-600">
              Vuoi eliminare definitivamente il conto{' '}
              <span className="font-semibold text-slate-950">{deletingAccount?.name}</span>?{' '}
              L&apos;azione non può essere annullata.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeletingAccount(null)}>Annulla</Button>
              <Button variant="destructive" onClick={deleteAccount} disabled={busyId === deletingAccount?.id}>
                Elimina
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
