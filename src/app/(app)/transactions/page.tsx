'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, ArrowLeftRight } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import { EmptyState } from '@/components/shared/EmptyState'
import { useTransactions } from '@/hooks/use-transactions'
import { useAccounts } from '@/hooks/use-accounts'
import { useCategories } from '@/hooks/use-categories'
import { formatDate } from '@/lib/utils'

const TRANSACTION_TYPE_LABELS = {
  income: 'Entrata',
  expense: 'Uscita',
  transfer: 'Giroconto',
} as const

const transactionSchema = z.object({
  description: z.string().min(1, 'Descrizione obbligatoria'),
  amount: z.coerce.number().positive('Importo deve essere positivo'),
  date: z.string().min(1, 'Data obbligatoria'),
  type: z.enum(['income', 'expense', 'transfer']),
  account_id: z.string().min(1, 'Seleziona un conto'),
  destination_account_id: z.string().optional(),
  category_id: z.string().optional(),
  notes: z.string().optional(),
})

type TransactionForm = z.infer<typeof transactionSchema>

export default function TransactionsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { transactions, loading, refetch } = useTransactions()
  const { accounts, refetch: refetchAccounts } = useAccounts()
  const { categories } = useCategories()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TransactionForm>({
    resolver: zodResolver(transactionSchema) as never,
    defaultValues: { type: 'expense', date: new Date().toISOString().split('T')[0] },
  })

  const selectedType = watch('type')
  const selectedAccountId = watch('account_id')
  const filteredCategories = categories.filter(
    (c) => c.type === selectedType || c.type === 'both',
  )

  const onSubmit: SubmitHandler<TransactionForm> = async (data) => {
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: data.description,
          amount: data.amount,
          date: data.date,
          type: data.type,
          account_id: data.account_id,
          destination_account_id: data.type === 'transfer' ? data.destination_account_id : undefined,
          category_id: data.category_id || null,
          notes: data.notes || null,
        }),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Errore nel salvataggio')
      }

      toast.success('Transazione aggiunta')
      setDialogOpen(false)
      reset()
      refetch()
      refetchAccounts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore nel salvataggio')
    }
  }

  const selectClasses =
    'flex h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200'

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Transazioni</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuova
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong rounded-2xl border-slate-200 bg-white/95 text-slate-900">
            <DialogHeader>
              <DialogTitle className="text-slate-900">Nuova transazione</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-600">Tipo</Label>
                <select {...register('type')} className={selectClasses}>
                  {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600">Descrizione</Label>
                <Input
                  {...register('description')}
                  placeholder="Descrizione"
                  className="h-11 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                />
                {errors.description && (
                  <p className="text-sm text-danger">{errors.description.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600">Importo</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register('amount')}
                  placeholder="0.00"
                  className="h-11 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                />
                {errors.amount && <p className="text-sm text-danger">{errors.amount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600">Data</Label>
                <Input
                  type="date"
                  {...register('date')}
                  className="h-11 border-slate-200 bg-white text-slate-900"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600">
                  {selectedType === 'transfer' ? 'Conto origine' : 'Conto'}
                </Label>
                <select {...register('account_id')} className={selectClasses}>
                  <option value="">Seleziona conto</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {errors.account_id && (
                  <p className="text-sm text-danger">{errors.account_id.message}</p>
                )}
              </div>
              {selectedType === 'transfer' && (
                <div className="space-y-2">
                  <Label className="text-slate-600">Conto destinazione</Label>
                  <select {...register('destination_account_id')} className={selectClasses}>
                    <option value="">Seleziona conto</option>
                    {accounts
                      .filter((a) => a.id !== selectedAccountId)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              {selectedType !== 'transfer' && (
                <div className="space-y-2">
                  <Label className="text-slate-600">Categoria</Label>
                  <select {...register('category_id')} className={selectClasses}>
                    <option value="">Nessuna categoria</option>
                    {filteredCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-slate-600">Note</Label>
                <Input
                  {...register('notes')}
                  placeholder="Note opzionali"
                  className="h-11 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <Button type="submit" className="h-12 w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Salvataggio...' : 'Salva'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="Nessuna transazione"
          description="Aggiungi la tua prima transazione per iniziare a tracciare le tue finanze."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tutte le transazioni</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {transactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{t.description}</p>
                    <p className="text-xs text-slate-400">{formatDate(t.date)}</p>
                  </div>
                  <AmountDisplay
                    amount={t.amount}
                    type={
                      t.type === 'income'
                        ? 'income'
                        : t.type === 'expense'
                          ? 'expense'
                          : 'neutral'
                    }
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
