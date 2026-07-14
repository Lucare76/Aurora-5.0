'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { MoreHorizontal, Pencil, Plus, Power, Repeat, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/EmptyState'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { useAccounts } from '@/hooks/use-accounts'
import { useCategories } from '@/hooks/use-categories'
import { FREQUENCY_LABELS, RECURRING_FREQUENCIES, type RecurringFrequency } from '@/lib/constants'
import type { RecurringRule, TransactionType } from '@/types/database'

const BORDER = '#e5e7f0'

const recurringSchema = z.object({
  description: z.string().trim().min(1, 'La descrizione è obbligatoria'),
  amount: z.coerce.number({ error: 'Inserisci un importo valido' }).positive('L’importo deve essere positivo'),
  type: z.enum(['income', 'expense']),
  frequency: z.enum(RECURRING_FREQUENCIES),
  start_date: z.string().min(1, 'La data di inizio è obbligatoria'),
  end_date: z.string().optional(),
  account_id: z.string().min(1, 'Seleziona un conto'),
  category_id: z.string().optional(),
  auto_create: z.boolean(),
})

type RecurringForm = z.infer<typeof recurringSchema>

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

function monthlyValue(amount: number, frequency: RecurringFrequency) {
  const multipliers: Record<RecurringFrequency, number> = {
    daily: 30,
    weekly: 4.33,
    biweekly: 2.16,
    monthly: 1,
    quarterly: 1 / 3,
    yearly: 1 / 12,
  }
  return amount * multipliers[frequency]
}

function nextDueFrom(startDate: string) {
  return startDate
}

export default function RecurringPage() {
  const supabase = createClient()
  const db = supabase
  const { accounts } = useAccounts()
  const { categories } = useCategories()
  const [rules, setRules] = useState<RecurringRule[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts])

  const form = useForm<RecurringForm>({
    resolver: zodResolver(recurringSchema) as Resolver<RecurringForm>,
    defaultValues: {
      description: '',
      amount: 0,
      type: 'expense',
      frequency: 'monthly',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      account_id: '',
      category_id: '',
      auto_create: true,
    },
  })

  const selectedType = form.watch('type')
  const filteredCategories = useMemo(
    () => categories.filter((category) => category.type === selectedType || category.type === 'both'),
    [categories, selectedType],
  )

  const fetchRules = async () => {
    setLoading(true)
    const { data, error } = await db
      .from('recurring_rules')
      .select('*')
      .order('next_due_date', { ascending: true })

    if (error) toast.error('Errore nel caricamento dei ricorrenti')
    setRules((data ?? []) as RecurringRule[])
    setLoading(false)
  }

  useEffect(() => {
    fetchRules()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totals = useMemo(() => {
    return rules.filter((rule) => rule.is_active).reduce(
      (summary, rule) => {
        const value = monthlyValue(rule.amount, rule.frequency)
        if (rule.type === 'income') summary.income += value
        if (rule.type === 'expense') summary.expense += value
        return summary
      },
      { income: 0, expense: 0 },
    )
  }, [rules])

  const openCreate = () => {
    setEditingRule(null)
    form.reset({
      description: '',
      amount: 0,
      type: 'expense',
      frequency: 'monthly',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      account_id: '',
      category_id: '',
      auto_create: true,
    })
    setDialogOpen(true)
  }

  const openEdit = (rule: RecurringRule) => {
    setOpenMenuId(null)
    setEditingRule(rule)
    form.reset({
      description: rule.description,
      amount: rule.amount,
      type: rule.type === 'income' ? 'income' : 'expense',
      frequency: rule.frequency,
      start_date: rule.start_date,
      end_date: rule.end_date ?? '',
      account_id: rule.account_id,
      category_id: rule.category_id ?? '',
      auto_create: rule.auto_create,
    })
    setDialogOpen(true)
  }

  const onSubmit: SubmitHandler<RecurringForm> = async (values) => {
    try {
      setBusy(true)
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Sessione scaduta. Accedi di nuovo.')

      const payload = {
        user_id: user.id,
        account_id: values.account_id,
        category_id: values.category_id || null,
        type: values.type as TransactionType,
        amount: values.amount,
        description: values.description,
        frequency: values.frequency,
        start_date: values.start_date,
        end_date: values.end_date || null,
        next_due_date: editingRule?.next_due_date ?? nextDueFrom(values.start_date),
        last_run_date: editingRule?.last_run_date ?? null,
        is_active: editingRule?.is_active ?? true,
        auto_create: values.auto_create,
      }

      const { error } = editingRule
        ? await db.from('recurring_rules').update(payload).eq('id', editingRule.id)
        : await db.from('recurring_rules').insert(payload)

      if (error) throw error
      toast.success(editingRule ? 'Ricorrente aggiornato' : 'Ricorrente creato')
      setDialogOpen(false)
      setEditingRule(null)
      await fetchRules()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante il salvataggio')
    } finally {
      setBusy(false)
    }
  }

  const toggleRule = async (rule: RecurringRule) => {
    try {
      const { error } = await db.from('recurring_rules').update({ is_active: !rule.is_active }).eq('id', rule.id)
      if (error) throw error
      toast.success(rule.is_active ? 'Ricorrente messo in pausa' : 'Ricorrente riattivato')
      setOpenMenuId(null)
      await fetchRules()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante l’aggiornamento')
    }
  }

  const deleteRule = async (rule: RecurringRule) => {
    try {
      const { error } = await db.from('recurring_rules').delete().eq('id', rule.id)
      if (error) throw error
      toast.success('Ricorrente eliminato')
      setOpenMenuId(null)
      await fetchRules()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante l’eliminazione')
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-950">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-indigo-600">Automazioni</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Ricorrenti</h1>
          </div>
          <Button onClick={openCreate} className="h-11 gap-2">
            <Plus className="h-4 w-4" />
            Nuovo
          </Button>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <Card className="border-[#e5e7f0] bg-white shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Uscite ricorrenti mensili</p>
              <p className="mt-3 text-3xl font-semibold tabular-nums text-red-600">{formatCurrency(totals.expense)}</p>
            </CardContent>
          </Card>
          <Card className="border-[#e5e7f0] bg-white shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Entrate ricorrenti mensili</p>
              <p className="mt-3 text-3xl font-semibold tabular-nums text-emerald-600">{formatCurrency(totals.income)}</p>
            </CardContent>
          </Card>
        </section>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl border border-[#e5e7f0] bg-white" />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <div className="rounded-3xl border border-[#e5e7f0] bg-white p-8 shadow-sm">
            <EmptyState
              icon={Repeat}
              title="Nessuna regola ricorrente"
              description="Configura abbonamenti, stipendi o spese fisse da monitorare automaticamente."
              action={<Button onClick={openCreate}>Nuovo ricorrente</Button>}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => {
              const account = accountById.get(rule.account_id)
              const dueIn = differenceInCalendarDays(parseISO(rule.next_due_date), new Date())
              const isSoon = dueIn >= 0 && dueIn <= 7

              return (
                <Card key={rule.id} className={cn('border-[#e5e7f0] bg-white shadow-sm', isSoon && 'border-red-200 bg-red-50/40')}>
                  <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate font-semibold text-slate-950">{rule.description}</h2>
                        <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', rule.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                          {rule.is_active ? 'Attivo' : 'Inattivo'}
                        </span>
                        {isSoon && <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">Entro 7 giorni</span>}
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        {FREQUENCY_LABELS[rule.frequency]} · Prossima scadenza {formatDate(rule.next_due_date)} · {account?.name ?? 'Conto'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-4 lg:justify-end">
                      <AmountDisplay amount={rule.amount} type={rule.type === 'income' ? 'income' : 'expense'} className="text-lg font-semibold" />
                      <div className="relative">
                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setOpenMenuId(openMenuId === rule.id ? null : rule.id)}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        {openMenuId === rule.id && (
                          <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-[#e5e7f0] bg-white p-1 shadow-xl shadow-slate-200">
                            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => openEdit(rule)}>
                              <Pencil className="h-4 w-4" />
                              Modifica
                            </button>
                            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => toggleRule(rule)}>
                              <Power className="h-4 w-4" />
                              {rule.is_active ? 'Pausa' : 'Riprendi'}
                            </button>
                            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50" onClick={() => deleteRule(rule)}>
                              <Trash2 className="h-4 w-4" />
                              Elimina
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Modifica ricorrente' : 'Nuovo ricorrente'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-700">Descrizione</Label>
                <Input {...form.register('description')} className="h-11 border-[#e5e7f0] bg-white text-slate-950" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700">Importo</Label>
                <Input type="number" step="0.01" {...form.register('amount')} className="h-11 border-[#e5e7f0] bg-white text-slate-950" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-700">Tipo</Label>
                <SelectField {...form.register('type')}>
                  <option value="expense">Uscita</option>
                  <option value="income">Entrata</option>
                </SelectField>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700">Frequenza</Label>
                <SelectField {...form.register('frequency')}>
                  {RECURRING_FREQUENCIES.map((frequency) => (
                    <option key={frequency} value={frequency}>
                      {FREQUENCY_LABELS[frequency]}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-700">Data inizio</Label>
                <Input type="date" {...form.register('start_date')} className="h-11 border-[#e5e7f0] bg-white text-slate-950" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700">Data fine opzionale</Label>
                <Input type="date" {...form.register('end_date')} className="h-11 border-[#e5e7f0] bg-white text-slate-950" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-700">Conto</Label>
                <SelectField {...form.register('account_id')}>
                  <option value="">Seleziona conto</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700">Categoria</Label>
                <SelectField {...form.register('category_id')}>
                  <option value="">Nessuna categoria</option>
                  {filteredCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>
            <label className="flex items-center justify-between rounded-2xl border border-[#e5e7f0] bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              Auto-crea transazione
              <input type="checkbox" {...form.register('auto_create')} className="h-5 w-5 accent-indigo-600" />
            </label>
            <Button type="submit" className="h-12 w-full" disabled={busy || form.formState.isSubmitting}>
              {busy || form.formState.isSubmitting ? 'Salvataggio...' : 'Salva'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
