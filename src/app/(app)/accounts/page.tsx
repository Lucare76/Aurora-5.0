'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Circle,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Trash2,
  Upload,
  Wallet,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

function AccountSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-44 animate-pulse rounded-2xl border border-[#e5e7f0] bg-white" />
      ))}
    </div>
  )
}

export default function AccountsPage() {
  const supabase = createClient()
  const db = supabase
  const { accounts, totalBalance, loading, refetch } = useAccounts()
  const [createOpen, setCreateOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const activeAccounts = useMemo(() => accounts.filter((account) => account.is_active).length, [accounts])

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
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) throw new Error('Sessione scaduta. Accedi di nuovo.')

      const { error } = await db
        .from('accounts')
        .insert({
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
        .update({
          name: values.name,
          type: values.type,
          color: values.color,
          currency: values.currency.toUpperCase(),
        })
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
      const { error } = await db
        .from('accounts')
        .update({ is_active: !account.is_active })
        .eq('id', account.id)

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

  const renderAccountForm = (
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
            {accountTypeOptions.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
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
      <div className="mx-auto max-w-7xl space-y-7">
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
            <div className="grid grid-cols-2 gap-3 sm:min-w-72">
              <div className="rounded-2xl border border-white bg-white/75 p-4 shadow-sm">
                <p className="text-xs text-slate-500">Conti totali</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{accounts.length}</p>
              </div>
              <div className="rounded-2xl border border-white bg-white/75 p-4 shadow-sm">
                <p className="text-xs text-slate-500">Attivi</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-indigo-600">{activeAccounts}</p>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <AccountSkeleton />
        ) : accounts.length === 0 ? (
          <div className="rounded-3xl border border-[#e5e7f0] bg-white p-8 shadow-sm">
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
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account) => (
              <Card key={account.id} className="relative overflow-visible border-[#e5e7f0] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-200/70">
                <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: account.color ?? '#6366f1' }}
                      />
                      <CardTitle className="truncate text-lg text-slate-950">{account.name}</CardTitle>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[#e5e7f0] bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {ACCOUNT_TYPE_LABELS[account.type as AccountType] ?? account.type}
                      </span>
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                        account.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
                      )}>
                        <Circle className="h-2 w-2 fill-current" />
                        {account.is_active ? 'Attivo' : 'Inattivo'}
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setOpenMenuId(openMenuId === account.id ? null : account.id)}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    {openMenuId === account.id && (
                      <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-[#e5e7f0] bg-white p-1 shadow-xl shadow-slate-200">
                        <button
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => openEditDialog(account)}
                        >
                          <Pencil className="h-4 w-4" />
                          Modifica
                        </button>
                        <button
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => toggleAccount(account)}
                          disabled={busyId === account.id}
                        >
                          <Power className="h-4 w-4" />
                          {account.is_active ? 'Disattiva' : 'Riattiva'}
                        </button>
                        <button
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setOpenMenuId(null)
                            setDeletingAccount(account)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Elimina
                        </button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold tracking-tight tabular-nums text-slate-950">
                    {formatCurrency(account.balance, account.currency)}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">Valuta {account.currency}</p>
                  {(account.name === 'Bancoposta' || account.name === 'Carta di Credito') && (
                    <Link href="/import-estratti">
                      <Button variant="outline" size="sm" className="mt-4 w-full gap-2 text-xs">
                        <Upload className="h-3.5 w-3.5" />
                        Importa estratto conto
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>Nuovo conto</DialogTitle>
          </DialogHeader>
          {renderAccountForm(createForm, 'Crea conto', onCreate)}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingAccount)} onOpenChange={(open) => !open && setEditingAccount(null)}>
        <DialogContent className="max-w-xl border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>Modifica conto</DialogTitle>
          </DialogHeader>
          {renderAccountForm(editForm, 'Salva modifiche', onEdit, true)}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deletingAccount)} onOpenChange={(open) => !open && setDeletingAccount(null)}>
        <DialogContent className="max-w-md border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>Elimina conto</DialogTitle>
          </DialogHeader>
          <div className="mt-5 space-y-5">
            <p className="text-sm leading-6 text-slate-600">
              Vuoi eliminare definitivamente il conto{' '}
              <span className="font-semibold text-slate-950">{deletingAccount?.name}</span>? L’azione non può essere annullata.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeletingAccount(null)}>
                Annulla
              </Button>
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
