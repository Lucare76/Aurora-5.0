'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Cake, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/EmptyState'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate } from '@/lib/utils'
import type { Birthday } from '@/types/database'

const REMINDERS = [1, 3, 7, 14, 30]

const birthdaySchema = z.object({
  name: z.string().trim().min(1, 'Il nome è obbligatorio'),
  birth_date: z.string().min(1, 'Inserisci la data di nascita'),
  reminder_days: z.array(z.number()),
  notes: z.string().optional(),
})

type BirthdayForm = z.infer<typeof birthdaySchema>

function nextBirthdayInfo(birthDate: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const born = new Date(`${birthDate}T00:00:00`)
  let next = new Date(today.getFullYear(), born.getMonth(), born.getDate())
  if (next < today) next = new Date(today.getFullYear() + 1, born.getMonth(), born.getDate())
  const days = Math.round((next.getTime() - today.getTime()) / 86400000)
  return { next, days, age: next.getFullYear() - born.getFullYear() }
}

function badgeClass(days: number) {
  if (days === 0) return 'bg-violet-100 text-violet-700'
  if (days <= 7) return 'bg-red-100 text-red-700'
  if (days <= 30) return 'bg-amber-100 text-amber-700'
  return 'bg-emerald-100 text-emerald-700'
}

export default function BirthdaysPage() {
  const supabase = createClient()
  const db = supabase
  const [birthdays, setBirthdays] = useState<Birthday[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBirthday, setEditingBirthday] = useState<Birthday | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const form = useForm<BirthdayForm>({
    resolver: zodResolver(birthdaySchema) as any,
    defaultValues: { name: '', birth_date: '', reminder_days: [7], notes: '' },
  })

  const fetchBirthdays = async () => {
    setLoading(true)
    const { data, error } = await db.from('birthdays').select('*')
    if (error) toast.error('Errore nel caricamento dei compleanni')
    setBirthdays((data ?? []) as Birthday[])
    setLoading(false)
  }

  useEffect(() => {
    fetchBirthdays()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enriched = useMemo(() => {
    return birthdays
      .map((birthday) => ({ birthday, ...nextBirthdayInfo(birthday.birth_date) }))
      .sort((a, b) => a.days - b.days)
  }, [birthdays])
  const todayBirthdays = enriched.filter((item) => item.days === 0)
  const upcomingBirthdays = enriched.filter((item) => item.days !== 0)

  const openCreate = () => {
    setEditingBirthday(null)
    form.reset({ name: '', birth_date: '', reminder_days: [7], notes: '' })
    setDialogOpen(true)
  }

  const openEdit = (birthday: Birthday) => {
    setOpenMenuId(null)
    setEditingBirthday(birthday)
    form.reset({
      name: birthday.name,
      birth_date: birthday.birth_date,
      reminder_days: birthday.reminder_days ?? [],
      notes: birthday.notes ?? '',
    })
    setDialogOpen(true)
  }

  const onSubmit: SubmitHandler<BirthdayForm> = async (values) => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Sessione scaduta. Accedi di nuovo.')

      const payload = {
        user_id: user.id,
        name: values.name,
        birth_date: values.birth_date,
        reminder_days: values.reminder_days,
        notes: values.notes || null,
      }
      const { error } = editingBirthday
        ? await db.from('birthdays').update(payload).eq('id', editingBirthday.id)
        : await db.from('birthdays').insert(payload)
      if (error) throw error
      toast.success(editingBirthday ? 'Compleanno aggiornato' : 'Compleanno creato')
      setDialogOpen(false)
      setEditingBirthday(null)
      await fetchBirthdays()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante il salvataggio')
    }
  }

  const deleteBirthday = async (birthday: Birthday) => {
    try {
      const { error } = await db.from('birthdays').delete().eq('id', birthday.id)
      if (error) throw error
      toast.success('Compleanno eliminato')
      setOpenMenuId(null)
      await fetchBirthdays()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante l’eliminazione')
    }
  }

  const renderRow = (birthday: Birthday, days: number, age: number) => (
    <Card key={birthday.id} className="border-[#e5e7f0] bg-white shadow-sm">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <p className="font-semibold text-slate-950">{birthday.name}</p>
          <p className="mt-1 text-sm text-slate-500">
            {formatDate(birthday.birth_date, 'dd MMMM yyyy')} · compirà {age} anni
          </p>
          {birthday.notes && <p className="mt-1 text-xs text-slate-400">{birthday.notes}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', badgeClass(days))}>
            {days === 0 ? 'Oggi' : `${days} giorni`}
          </span>
          <div className="relative">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setOpenMenuId(openMenuId === birthday.id ? null : birthday.id)}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            {openMenuId === birthday.id && (
              <div className="absolute right-0 top-10 z-20 w-40 rounded-xl border border-[#e5e7f0] bg-white p-1 shadow-xl shadow-slate-200">
                <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50" onClick={() => openEdit(birthday)}>
                  <Pencil className="h-4 w-4" />
                  Modifica
                </button>
                <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50" onClick={() => deleteBirthday(birthday)}>
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

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-950">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-indigo-600">Promemoria</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Compleanni</h1>
          </div>
          <Button onClick={openCreate} className="h-11 gap-2">
            <Plus className="h-4 w-4" />
            Nuovo
          </Button>
        </header>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl border border-[#e5e7f0] bg-white" />)}</div>
        ) : birthdays.length === 0 ? (
          <div className="rounded-3xl border border-[#e5e7f0] bg-white p-8 shadow-sm">
            <EmptyState icon={Cake} title="Nessun compleanno" description="Aggiungi le persone importanti e i reminder." action={<Button onClick={openCreate}>Nuovo compleanno</Button>} />
          </div>
        ) : (
          <div className="space-y-7">
            {todayBirthdays.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-violet-700">Oggi</h2>
                {todayBirthdays.map((item) => renderRow(item.birthday, item.days, item.age))}
              </section>
            )}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500">Prossimi compleanni</h2>
              {upcomingBirthdays.map((item) => renderRow(item.birthday, item.days, item.age))}
            </section>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader><DialogTitle>{editingBirthday ? 'Modifica compleanno' : 'Nuovo compleanno'}</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Nome</Label><Input {...form.register('name')} className="h-11 border-[#e5e7f0] bg-white text-slate-950" /></div>
              <div className="space-y-2"><Label>Data nascita</Label><Input type="date" {...form.register('birth_date')} className="h-11 border-[#e5e7f0] bg-white text-slate-950" /></div>
            </div>
            <div className="space-y-2">
              <Label>Reminder</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {REMINDERS.map((day) => (
                  <label key={day} className="flex items-center gap-2 rounded-xl border border-[#e5e7f0] bg-slate-50 px-3 py-2 text-sm">
                    <input type="checkbox" value={day} checked={form.watch('reminder_days').includes(day)} onChange={(event) => {
                      const current = form.getValues('reminder_days')
                      form.setValue('reminder_days', event.target.checked ? [...current, day] : current.filter((value) => value !== day))
                    }} className="accent-indigo-600" />
                    {day}g
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2"><Label>Note</Label><Input {...form.register('notes')} className="h-11 border-[#e5e7f0] bg-white text-slate-950" /></div>
            <Button type="submit" className="h-12 w-full" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Salvataggio...' : 'Salva'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
