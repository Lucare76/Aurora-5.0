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
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'

const TRANSACTION_TYPE_LABELS = {
  income: 'Entrata',
  expense: 'Uscita',
  transfer: 'Giroconto',
}

const transactionSchema = z.object({
  description: z.string().min(1, 'Descrizione obbligatoria'),
  amount: z.coerce.number().positive('Importo deve essere positivo'),
  date: z.string().min(1, 'Data obbligatoria'),
  type: z.enum(['income', 'expense', 'transfer']),
  account_id: z.string().min(1, 'Seleziona un conto'),
  category_id: z.string().optional(),
  notes: z.string().optional(),
})

type TransactionForm = {
  description: string
  amount: number
  date: string
  type: 'income' | 'expense' | 'transfer'
  account_id: string
  category_id?: string
  notes?: string
}

export default function TransactionsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { transactions, loading, refetch } = useTransactions()
  const { accounts } = useAccounts()
  const { categories } = useCategories()

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<TransactionForm>({
    resolver: zodResolver(transactionSchema) as any,
    defaultValues: { type: 'expense', date: new Date().toISOString().split('T')[0] },
  })

  const selectedType = watch('type')
  const filteredCategories = categories.filter((c) => c.type === selectedType || c.type === 'both')

  const onSubmit: SubmitHandler<TransactionForm> = async (data) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non autenticato')

      const { error } = await supabase.from('transactions').insert({
        description: data.description,
        amount: data.amount,
        date: data.date,
        type: data.type,
        account_id: data.account_id,
        category_id: data.category_id || null,
        notes: data.notes || null,
        user_id: user.id,
      } as any)
      if (error) throw error

      await (supabase.rpc as any)('adjust_account_balance', {
        p_account_id: data.account_id,
        p_amount: data.type === 'income' ? data.amount : -data.amount,
      })

      toast.success('Transazione aggiunta')
      setDialogOpen(false)
      reset()
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore nel salvataggio')
    }
  }

  const selectClasses = "flex h-11 w-full rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm text-white focus:border-aurora-purple/50 focus:outline-none focus:ring-2 focus:ring-aurora-purple/20"

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Transazioni</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuova
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong rounded-2xl border-white/10 bg-[#12142a]/95 text-white">
            <DialogHeader>
              <DialogTitle className="text-white">Nuova transazione</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-white/70">Tipo</Label>
                <select {...register('type')} className={selectClasses}>
                  {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Descrizione</Label>
                <Input {...register('description')} placeholder="Descrizione" className="h-11 border-white/8 bg-white/5 text-white placeholder:text-white/25" />
                {errors.description && <p className="text-sm text-danger">{errors.description.message}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Importo</Label>
                <Input type="number" step="0.01" {...register('amount')} placeholder="0.00" className="h-11 border-white/8 bg-white/5 text-white placeholder:text-white/25" />
                {errors.amount && <p className="text-sm text-danger">{errors.amount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Data</Label>
                <Input type="date" {...register('date')} className="h-11 border-white/8 bg-white/5 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Conto</Label>
                <select {...register('account_id')} className={selectClasses}>
                  <option value="">Seleziona conto</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                {errors.account_id && <p className="text-sm text-danger">{errors.account_id.message}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Categoria</Label>
                <select {...register('category_id')} className={selectClasses}>
                  <option value="">Nessuna categoria</option>
                  {filteredCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Note</Label>
                <Input {...register('notes')} placeholder="Note opzionali" className="h-11 border-white/8 bg-white/5 text-white placeholder:text-white/25" />
              </div>
              <Button type="submit" className="w-full h-12" disabled={isSubmitting}>
                {isSubmitting ? 'Salvataggio...' : 'Salva'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-white/3 animate-pulse" />
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
                <div key={t.id} className="flex items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.03]">
                  <div>
                    <p className="text-sm font-medium text-white">{t.description}</p>
                    <p className="text-xs text-white/35">{formatDate(t.date)}</p>
                  </div>
                  <AmountDisplay
                    amount={t.amount}
                    type={t.type === 'income' ? 'income' : t.type === 'expense' ? 'expense' : 'neutral'}
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
