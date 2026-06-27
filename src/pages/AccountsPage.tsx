import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { useAccounts } from '@/hooks/useAccounts'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'

const ACCOUNT_TYPES = ['checking', 'savings', 'cash', 'credit', 'investment', 'other'] as const
const ACCOUNT_TYPE_LABELS: Record<typeof ACCOUNT_TYPES[number], string> = {
  checking: 'Conto corrente',
  savings: 'Risparmio',
  cash: 'Contanti',
  credit: 'Carta di credito',
  investment: 'Investimenti',
  other: 'Altro',
}

const accountSchema = z.object({
  name: z.string().min(1, 'Nome obbligatorio'),
  type: z.enum(ACCOUNT_TYPES),
  balance: z.coerce.number(),
  currency: z.string().default('EUR'),
})

type AccountForm = {
  name: string
  type: typeof ACCOUNT_TYPES[number]
  balance: number
  currency: string
}

export default function AccountsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { accounts, totalBalance, loading, refetch } = useAccounts()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AccountForm>({
    resolver: zodResolver(accountSchema) as any,
    defaultValues: { type: 'checking', currency: 'EUR', balance: 0 },
  })

  const onSubmit: SubmitHandler<AccountForm> = async (data) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non autenticato')

      const { error } = await supabase.from('accounts').insert({
        name: data.name,
        type: data.type,
        balance: data.balance,
        currency: data.currency,
        user_id: user.id,
        is_active: true,
        sort_order: 0,
        color: null,
        icon: null,
      } as any)
      if (error) throw error
      toast.success('Conto creato')
      setDialogOpen(false)
      reset()
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore nel salvataggio')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Conti</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nuovo conto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuovo conto</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input {...register('name')} placeholder="Nome del conto" />
                {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <select {...register('type')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {ACCOUNT_TYPES.map((type) => (
                    <option key={type} value={type}>{ACCOUNT_TYPE_LABELS[type]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Saldo iniziale</Label>
                <Input type="number" step="0.01" {...register('balance')} />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Salvataggio...' : 'Crea conto'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Saldo totale</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold tabular-nums">{formatCurrency(totalBalance)}</p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState icon={Wallet} title="Nessun conto" description="Crea il tuo primo conto per iniziare." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{account.name}</CardTitle>
                <Badge variant="secondary">{ACCOUNT_TYPE_LABELS[account.type as typeof ACCOUNT_TYPES[number]] ?? account.type}</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">{formatCurrency(account.balance, account.currency)}</p>
                {!account.is_active && <p className="text-xs text-muted-foreground mt-1">Disattivato</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}