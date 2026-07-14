'use client'

import { useMemo, useState } from 'react'
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
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const profileSchema = z.object({
  display_name: z.string().trim().min(1, 'Il nome è obbligatorio'),
  currency: z.enum(['EUR', 'USD', 'GBP', 'CHF']),
  timezone: z.string().trim().min(1, 'Il fuso orario è obbligatorio'),
})

type ProfileForm = z.infer<typeof profileSchema>

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
  const supabase = createClient()
  const db = supabase
  const { user, profile, signOut } = useAuth()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [busy, setBusy] = useState(false)

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
        db.from('transactions').select('date,type,description,amount,category_id,account_id,transfer_peer_id').order('date', { ascending: false }),
        db.from('categories').select('id,name'),
        db.from('accounts').select('id,name'),
      ])
      if (txRes.error) throw txRes.error

      const catById = new Map((catRes.data ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))
      const accById = new Map((accRes.data ?? []).map((a: { id: string; name: string }) => [a.id, a.name]))

      const header = ['Data', 'Tipo', 'Descrizione', 'Categoria', 'Conto', 'Importo (EUR)']
      const rows = (txRes.data ?? [])
        .filter((t: Record<string, unknown>) => !t.transfer_peer_id)
        .map((t: Record<string, unknown>) => [
          t.date,
          t.type === 'income' ? 'Entrata' : 'Uscita',
          `"${String(t.description ?? '').replace(/"/g, '""')}"`,
          `"${String(catById.get(t.category_id as string) ?? 'Senza categoria').replace(/"/g, '""')}"`,
          `"${String(accById.get(t.account_id as string) ?? '').replace(/"/g, '""')}"`,
          Number(t.amount).toFixed(2),
        ])

      const csv = [header, ...rows].map((row) => (row as unknown[]).join(',')).join('\n')
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
