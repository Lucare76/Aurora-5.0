'use client'

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
import { useAccounts } from '@/hooks/use-accounts'
import { formatCurrency } from '@/lib/utils'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, type AccountType } from '@/lib/constants'

const accountSchema = z.object({
  name: z.string().min(1, 'Nome obbligatorio'),
  type: z.enum(ACCOUNT_TYPES),
  balance: z.coerce.number(),
  currency: z.string().default('EUR'),
})

type AccountForm = z.infer<typeof accountSchema>

export default function AccountsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { accounts, totalBalance, loading, refetch } = useAccounts()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountForm>({
    resolver: zodResolver(accountSchema) as never,
    defaultValues: { type: 'checking', currency: 'EUR', balance: 0 },
  })

  const onSubmit: SubmitHandler<AccountForm> = async (data) => {
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Errore nel salvataggio')
      }

      toast.success('Conto creato')
      setDialogOpen(false)
      reset()
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore nel salvataggio')
    }
  }

  const selectClasses =
    'flex h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200'

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Conti</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuovo conto
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong rounded-2xl border-slate-200 bg-white/95 text-slate-900">
            <DialogHeader>
              <DialogTitle className="text-slate-900">Nuovo conto</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-600">Nome</Label>
                <Input
                  {...register('name')}
                  placeholder="Nome del conto"
                  className="h-11 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                />
                {errors.name && <p className="text-sm text-danger">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600">Tipo</Label>
                <select {...register('type')} className={selectClasses}>
                  {ACCOUNT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {ACCOUNT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600">Saldo iniziale</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register('balance')}
                  className="h-11 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <Button type="submit" className="h-12 w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Salvataggio...' : 'Crea conto'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="glass-card relative overflow-hidden rounded-2xl p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/80 to-emerald-50/60" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-300/40 to-transparent" />
        <div className="relative">
          <p className="text-sm text-slate-500">Saldo totale</p>
          <p className="mt-2 text-4xl font-bold tabular-nums text-slate-900">
            {formatCurrency(totalBalance)}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nessun conto"
          description="Crea il tuo primo conto per iniziare."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {accounts.map((account) => (
            <Card key={account.id} className="group relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-300/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base text-slate-900">{account.name}</CardTitle>
                <Badge
                  variant="secondary"
                  className="border-slate-200 bg-white text-slate-500"
                >
                  {ACCOUNT_TYPE_LABELS[account.type as AccountType] ?? account.type}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums text-slate-900">
                  {formatCurrency(account.balance, account.currency)}
                </p>
                {!account.is_active && (
                  <p className="mt-1 text-xs text-slate-400">Disattivato</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
