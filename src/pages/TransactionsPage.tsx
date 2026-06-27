import { useState } from 'react'
import { useForm } from 'react-hook-form'
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
import { TRANSACTION_TYPE_LABELS } from '@/lib/constants'
import type { TransactionType } from '@/types/database'

const transactionSchema = z.object({
  description: z.string().min(1, 'Descrizione obbligatoria'),
  amount: z.coerce.number().positive('Importo deve essere positivo'),
  date: z.string().min(1, 'Data obbligatoria'),
  type: z.enum(['income', 'expense', 'transfer']),
  account_id: z.string().min(1, 'Seleziona un conto'),
  category_id: z.string().optional(),
  notes: z.string().optional(),
})

type TransactionForm = z.infer<typeof transactionSchema>

export default function TransactionsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { transactions, loading, refetch } = useTransactions()
  const { accounts } = useAccounts()
  const { categories } = useCategories()

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<TransactionForm>({
    resolver: zodResolver(transactionSchema),
    defaultValues: { type: 'expense', date: new Date().toISOString().split('T')[0] },
  })

  const selectedType = watch('type')

  const filteredCategories = categories.filter((c) => c.type === selectedType)

  const onSubmit = async (data: TransactionForm) => {
    try {
      const { error } = await supabase.from('transactions').insert({
        description: data.description,
        amount: data.amount,
        date: data.date,
        type: data.type as TransactionType,
        account_id: data.account_id,
        category_id: data.category_id || null,
        notes: data.notes || null,
        user_id: (await supabase.auth.getUser()).data.user!.id,
        transfer_to_account_id: null,
        recurring_rule_id: null,
      })
      if (error) throw error

      await supabase.rpc('adjust_account_balance', {
        p_account_id: data.account_id,
        p_amount: data.type === 'income' ? data.amount : -data.amount,
      })

      toast.success('Transazione aggiunta')
      setDialogOpen(false)
      reset()
      refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore nel salvataggio')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transazioni</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuova
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuova transazione</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <select {...register('type')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Descrizione</Label>
                <Input {...register('description')} placeholder="Descrizione" />
                {errors.description && <p className="text-sm text-danger">{errors.description.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Importo</Label>
                <Input type="number" step="0.01" {...register('amount')} placeholder="0.00" />
                {errors.amount && <p className="text-sm text-danger">{errors.amount.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" {...register('date')} />
              </div>
              <div className="space-y-2">
                <Label>Conto</Label>
                <select {...register('account_id')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Seleziona conto</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                {errors.account_id && <p className="text-sm text-danger">{errors.account_id.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <select {...register('category_id')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Nessuna categoria</option>
                  {filteredCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Note</Label>
                <Input {...register('notes')} placeholder="Note opzionali" />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Salvataggio...' : 'Salva'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
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
            <CardTitle>Tutte le transazioni</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{t.description}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
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
