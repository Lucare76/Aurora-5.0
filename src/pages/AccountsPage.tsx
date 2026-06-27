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

  const selectClasses = "flex h-11 w-full rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm text-white focus:border-aurora-purple/50 focus:outline-none focus:ring-2 focus:ring-aurora-purple/20"

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Conti</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nuovo conto</Button>
          </DialogTrigger>
          <DialogContent className="glass-strong rounded-2xl border-white/10 bg-[#12142a]/95 text-white">
            <DialogHeader>
              <DialogTitle className="text-white">Nuovo conto</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-white/70">Nome</Label>
                <Input {...register('name')} placeholder="Nome del conto" className="h-11 border-white/8 bg-white/5 text-white placeholder:text-white/25" />
                {errors.name && <p className="text-sm text-danger">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Tipo</Label>
                <select {...register('type')} className={selectClasses}>
                  {ACCOUNT_TYPES.map((type) => (
                    <option key={type} value={type}>{ACCOUNT_TYPE_LABELS[type]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Saldo iniziale</Label>
                <Input type="number" step="0.01" {...register('balance')} className="h-11 border-white/8 bg-white/5 text-white placeholder:text-white/25" />
              </div>
              <Button type="submit" className="w-full h-12" disabled={isSubmitting}>
                {isSubmitting ? 'Salvataggio...' : 'Crea conto'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="glass-card relative overflow-hidden rounded-2xl p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-aurora-purple/5 to-aurora-emerald/5" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-aurora-purple/30 to-transparent" />
        <div className="relative">
          <p className="text-sm text-white/40">Saldo totale</p>
          <p className="mt-2 text-4xl font-bold tabular-nums text-white">{formatCurrency(totalBalance)}</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-white/3 animate-pulse" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState icon={Wallet} title="Nessun conto" description="Crea il tuo primo conto per iniziare." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {accounts.map((account, i) => (
            <div key={account.id} className={`animate-slide-up delay-${(i + 1) * 100}`}>
              <Card className="group relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-aurora-purple/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base text-white">{account.name}</CardTitle>
                  <Badge variant="secondary" className="bg-white/5 text-white/50 border-white/8">{ACCOUNT_TYPE_LABELS[account.type as typeof ACCOUNT_TYPES[number]] ?? account.type}</Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums text-white">{formatCurrency(account.balance, account.currency)}</p>
                  {!account.is_active && <p className="text-xs text-white/30 mt-1">Disattivato</p>}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
