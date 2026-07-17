'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Tags } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/EmptyState'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useCategories } from '@/hooks/use-categories'
import type { Category } from '@/types/database'
import { CollapsibleCategorySection, toggleExpandedCategoryIds } from './collapsible-category-list'

const BORDER = '#e5e7f0'
const COLORS = ['#6366f1', '#10b981', '#06b6d4', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#84cc16', '#f97316', '#0ea5e9', '#64748b']
const ICONS = ['🏠', '🛒', '🍽️', '🚗', '💡', '🎁', '💼', '💰', '🎮', '✈️', '❤️', '📚']

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Il nome è obbligatorio'),
  type: z.enum(['income', 'expense', 'both']),
  color: z.string().min(1),
  icon: z.string().optional(),
  parent_id: z.string().optional(),
})

type CategoryForm = z.infer<typeof categorySchema>

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

export default function CategoriesPage() {
  const supabase = createClient()
  const db = supabase
  const { categories, loading: categoriesLoading, refetch: refetchCategories, getCategoryTree } = useCategories()
  const [txCategoryIds, setTxCategoryIds] = useState<Array<{ category_id: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(() => new Set())

  const form = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema) as Resolver<CategoryForm>,
    defaultValues: { name: '', type: 'expense', color: '#6366f1', icon: '🏠', parent_id: '' },
  })
  const selectedType = form.watch('type')

  const fetchData = async () => {
    setLoading(true)
    const { data: transactionRows, error: transactionError } = await db.from('transactions').select('category_id')
    if (transactionError) toast.error('Errore nel caricamento delle categorie')
    setTxCategoryIds(transactionRows ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const transactionCount = useMemo(() => {
    return txCategoryIds.reduce<Record<string, number>>((counts, row) => {
      if (!row.category_id) return counts
      counts[row.category_id] = (counts[row.category_id] ?? 0) + 1
      return counts
    }, {})
  }, [txCategoryIds])

  const childrenOf = (parentId: string) => categories.filter((category) => category.parent_id === parentId)
  const parentOptions = categories.filter((category) => {
    if (category.parent_id || category.id === editingCategory?.id) return false
    return selectedType === 'both' || category.type === selectedType || category.type === 'both'
  })

  const openCreate = () => {
    setEditingCategory(null)
    form.reset({ name: '', type: 'expense', color: '#6366f1', icon: '🏠', parent_id: '' })
    setDialogOpen(true)
  }

  const openEdit = (category: Category) => {
    setOpenMenuId(null)
    setEditingCategory(category)
    form.reset({
      name: category.name,
      type: category.type,
      color: category.color ?? '#6366f1',
      icon: category.icon ?? '🏠',
      parent_id: category.parent_id ?? '',
    })
    setDialogOpen(true)
  }

  const openCreateChild = (parent: Category) => {
    setOpenMenuId(null)
    setEditingCategory(null)
    form.reset({
      name: '',
      type: parent.type,
      color: parent.color ?? '#6366f1',
      icon: parent.icon ?? '🏠',
      parent_id: parent.id,
    })
    setDialogOpen(true)
  }

  const toggleCategoryExpanded = (categoryId: string) => {
    setExpandedCategoryIds((current) => toggleExpandedCategoryIds(current, categoryId))
  }

  const onSubmit: SubmitHandler<CategoryForm> = async (values) => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Sessione scaduta. Accedi di nuovo.')

      const payload = {
        user_id: user.id,
        name: values.name,
        type: values.type,
        color: values.color,
        icon: values.icon || null,
        parent_id: values.parent_id || null,
        is_default: false,
        sort_order: categories.length,
      }

      const { error } = editingCategory
        ? await db.from('categories').update(payload).eq('id', editingCategory.id)
        : await db.from('categories').insert(payload)

      if (error) throw error
      toast.success(editingCategory ? 'Categoria aggiornata' : 'Categoria creata')
      setDialogOpen(false)
      setEditingCategory(null)
      await refetchCategories()
      await fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante il salvataggio')
    }
  }

  const deleteCategory = async (category: Category) => {
    if ((transactionCount[category.id] ?? 0) > 0) {
      toast.error('Non puoi eliminare una categoria con transazioni collegate')
      return
    }
    if (childrenOf(category.id).length > 0) {
      toast.error('Elimina prima le sottocategorie')
      return
    }

    try {
      const { error } = await db.from('categories').delete().eq('id', category.id)
      if (error) throw error
      toast.success('Categoria eliminata')
      setOpenMenuId(null)
      await refetchCategories()
      await fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante l’eliminazione')
    }
  }

  const renderSection = (title: string, type: 'income' | 'expense') => {
    const items = getCategoryTree(type)
    return (
      <CollapsibleCategorySection
        title={title}
        type={type}
        items={items}
        transactionCount={transactionCount}
        openMenuId={openMenuId}
        expandedCategoryIds={expandedCategoryIds}
        onToggleExpanded={toggleCategoryExpanded}
        onToggleMenu={(categoryId) => setOpenMenuId(openMenuId === categoryId ? null : categoryId)}
        onEdit={openEdit}
        onCreateChild={openCreateChild}
        onDelete={deleteCategory}
      />
    )
  }

  if (loading || categoriesLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-56 animate-pulse rounded-xl bg-slate-100" />
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-2xl border border-[#e5e7f0] bg-white" />
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-950">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-indigo-600">Organizzazione</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Categorie</h1>
          </div>
          <Button onClick={openCreate} className="h-11 gap-2">
            <Plus className="h-4 w-4" />
            Nuova categoria
          </Button>
        </header>

        {categories.length === 0 ? (
          <div className="rounded-3xl border border-[#e5e7f0] bg-white p-8 shadow-sm">
            <EmptyState
              icon={Tags}
              title="Nessuna categoria"
              description="Crea categorie personalizzate per leggere meglio entrate e uscite."
              action={<Button onClick={openCreate}>Nuova categoria</Button>}
            />
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            {renderSection('Uscite', 'expense')}
            {renderSection('Entrate', 'income')}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl border-[#e5e7f0] bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Modifica categoria' : 'Nuova categoria'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-slate-700">Nome</Label>
              <Input {...form.register('name')} className="h-11 border-[#e5e7f0] bg-white text-slate-950" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-700">Tipo</Label>
                <SelectField {...form.register('type')}>
                  <option value="expense">Uscita</option>
                  <option value="income">Entrata</option>
                  <option value="both">Entrambe</option>
                </SelectField>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700">Categoria padre</Label>
                <SelectField {...form.register('parent_id')}>
                  <option value="">Nessuna</option>
                  {categories
                    .filter((category) => parentOptions.some((parent) => parent.id === category.id))
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </SelectField>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700">Colore</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn('h-9 w-9 rounded-full border-4 border-white shadow ring-1 ring-slate-200', form.watch('color') === color && 'ring-2 ring-indigo-500')}
                    style={{ backgroundColor: color }}
                    onClick={() => form.setValue('color', color)}
                    aria-label={`Colore ${color}`}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700">Icona</Label>
              <SelectField {...form.register('icon')}>
                {ICONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </SelectField>
            </div>
            <Button type="submit" className="h-12 w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Salvataggio...' : 'Salva categoria'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
