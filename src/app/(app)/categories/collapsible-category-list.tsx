import {
  BookOpen, Briefcase, Car, ChevronDown, ChevronRight, Code, Cpu,
  Gamepad2, Gift, Heart, Home, MoreHorizontal, Pencil, Plane,
  Plus, Repeat, RotateCcw, ShoppingCart, Shirt, Trash2,
  TrendingUp, Utensils, Zap, type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { CategoryTreeNode } from '@/hooks/use-categories'
import type { Category, CategoryType } from '@/types/database'

type CollapsibleCategorySectionProps = {
  title: string
  type: 'income' | 'expense'
  items: CategoryTreeNode[]
  transactionCount: Record<string, number>
  openMenuId: string | null
  expandedCategoryIds: Set<string>
  onToggleExpanded: (categoryId: string) => void
  onToggleMenu: (categoryId: string) => void
  onEdit: (category: Category) => void
  onCreateChild: (category: Category) => void
  onDelete: (category: Category) => void
}

export function toggleExpandedCategoryIds(current: Set<string>, categoryId: string): Set<string> {
  const next = new Set(current)
  if (next.has(categoryId)) {
    next.delete(categoryId)
  } else {
    next.add(categoryId)
  }
  return next
}

export function CollapsibleCategorySection({
  title,
  type,
  items,
  transactionCount,
  openMenuId,
  expandedCategoryIds,
  onToggleExpanded,
  onToggleMenu,
  onEdit,
  onCreateChild,
  onDelete,
}: CollapsibleCategorySectionProps) {
  const childrenByParentId = new Map<string, Category[]>()
  for (const node of items) {
    childrenByParentId.set(node.category.id, node.children)
  }

  const renderCategory = (category: Category, depth = 0): React.ReactNode => {
    const childCategories = childrenByParentId.get(category.id) ?? []
    const hasChildren = childCategories.length > 0
    const isExpanded = expandedCategoryIds.has(category.id)

    return (
      <div key={category.id}>
        <div
          className={cn(
            'relative flex items-center justify-between gap-4 rounded-2xl border border-[#e5e7f0] bg-white px-4 py-3 shadow-sm hover:bg-slate-50/70',
            depth > 0 && 'border-l-4 border-l-indigo-200',
          )}
          style={{ marginLeft: depth * 24 }}
        >
          {depth > 0 && <span className="absolute -left-4 top-1/2 h-px w-4 bg-indigo-200" />}
          <div className="flex min-w-0 items-center gap-3">
            {hasChildren ? (
              <button
                type="button"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-indigo-600"
                onClick={() => onToggleExpanded(category.id)}
                aria-label={isExpanded ? `Comprimi ${category.name}` : `Espandi ${category.name}`}
                aria-expanded={isExpanded}
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : (
              <span className="h-8 w-8 shrink-0" />
            )}
            <span
              className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg', depth > 0 && 'h-8 w-8 text-sm')}
              style={{ backgroundColor: `${category.color ?? '#6366f1'}18`, color: category.color ?? '#6366f1' }}
            >
              <CategoryIcon icon={category.icon} size={depth > 0 ? 'sm' : 'md'} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">{category.name}</p>
              <p className="mt-1 text-xs text-slate-500">{transactionCount[category.id] ?? 0} movimenti</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-[#e5e7f0] bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
              {category.parent_id ? 'Sottocategoria' : typeLabel(category.type)}
            </span>
            <div className="relative">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onToggleMenu(category.id)}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              {openMenuId === category.id && (
                <div className="absolute right-0 top-10 z-20 w-40 rounded-xl border border-[#e5e7f0] bg-white p-1 shadow-xl shadow-slate-200">
                  <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => onEdit(category)}>
                    <Pencil className="h-4 w-4" />
                    Modifica
                  </button>
                  {!category.parent_id && (
                    <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-indigo-600 hover:bg-indigo-50" onClick={() => onCreateChild(category)}>
                      <Plus className="h-4 w-4" />
                      Aggiungi sottocategoria
                    </button>
                  )}
                  <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50" onClick={() => onDelete(category)}>
                    <Trash2 className="h-4 w-4" />
                    Elimina
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div className="mt-2 space-y-2">
            {childCategories.map((child) => renderCategory(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="border-[#e5e7f0] bg-white/70 shadow-sm">
      <CardHeader>
        <CardTitle className={cn('text-lg', type === 'income' ? 'text-emerald-600' : 'text-red-600')}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#e5e7f0] p-6 text-center text-sm text-slate-500">Nessuna categoria</p>
        ) : (
          <div className="space-y-2">
            {items.map((node) => (
              <div key={node.category.id}>{renderCategory(node.category)}</div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
  'home': Home,
  'shopping-cart': ShoppingCart,
  'car': Car,
  'heart': Heart,
  'game': Gamepad2,
  'utensils': Utensils,
  'shirt': Shirt,
  'cpu': Cpu,
  'book': BookOpen,
  'plane': Plane,
  'zap': Zap,
  'repeat': Repeat,
  'more-horizontal': MoreHorizontal,
  'briefcase': Briefcase,
  'code': Code,
  'trending-up': TrendingUp,
  'gift': Gift,
  'rotate-ccw': RotateCcw,
}

function CategoryIcon({ icon, size }: { icon: string | null | undefined; size: 'md' | 'sm' }) {
  if (!icon) return <span>•</span>
  const Icon = LUCIDE_ICON_MAP[icon]
  if (Icon) return <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
  return <span>{icon}</span>
}

function typeLabel(type: CategoryType) {
  if (type === 'income') return 'Entrata'
  if (type === 'expense') return 'Uscita'
  return 'Entrambe'
}
