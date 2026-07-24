'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeftRight,
  BarChart3,
  Cake,
  Command,
  DatabaseBackup,
  Download,
  HandCoins,
  LayoutDashboard,
  Loader2,
  Plus,
  Repeat,
  Search,
  Settings,
  Tag,
  Target,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGlobalSearch } from '@/hooks/use-global-search'
import { cn } from '@/lib/utils'
import type { QuickCommand, SearchGroup, SearchResult, SearchResultType } from '@/lib/search/types'

type CommandItem =
  | { kind: 'quick'; id: string; group: string; title: string; subtitle: string; href: string; icon: LucideIcon; keywords: string[] }
  | { kind: 'result'; id: string; group: string; result: SearchResult; icon: LucideIcon }

const typeIcons: Record<SearchResultType, LucideIcon> = {
  TRANSACTION: ArrowLeftRight,
  ACCOUNT: Wallet,
  CATEGORY: Tag,
  BUDGET: Target,
  GOAL: Target,
  LOAN: HandCoins,
  RECURRENCE: Repeat,
}

const quickCommands: Array<QuickCommand & { icon: LucideIcon }> = [
  { id: 'new-transaction', group: 'Azioni rapide', title: 'Nuovo movimento', subtitle: 'Apri il form transazioni', href: '/transactions?action=create', keywords: ['nuova transazione', 'nuovo movimento', 'entrata', 'uscita'], icon: Plus },
  { id: 'new-transfer', group: 'Azioni rapide', title: 'Nuovo trasferimento', subtitle: 'Apri i movimenti e scegli Giroconto', href: '/transactions?action=create&type=transfer', keywords: ['giroconto', 'trasferimento'], icon: ArrowLeftRight },
  { id: 'new-budget', group: 'Azioni rapide', title: 'Nuovo budget', subtitle: 'Crea un budget mensile', href: '/budgets?action=create', keywords: ['budget', 'nuovo budget'], icon: Target },
  { id: 'new-goal', group: 'Azioni rapide', title: 'Nuovo obiettivo', subtitle: 'Crea un obiettivo di risparmio', href: '/goals?action=create', keywords: ['obiettivo', 'risparmio'], icon: Target },
  { id: 'add-goal-contribution', group: 'Azioni rapide', title: 'Aggiungi versamento', subtitle: 'Vai agli obiettivi e scegli il traguardo', href: '/goals?action=contribution', keywords: ['versamento', 'aggiungi versamento'], icon: Plus },
  { id: 'new-loan', group: 'Azioni rapide', title: 'Nuovo prestito', subtitle: 'Apri la pagina prestiti', href: '/loans?action=create', keywords: ['prestito'], icon: HandCoins },
  { id: 'new-recurring', group: 'Azioni rapide', title: 'Nuova ricorrenza', subtitle: 'Apri il form ricorrenti', href: '/recurring?action=create', keywords: ['ricorrenza', 'abbonamento'], icon: Repeat },
  { id: 'import', group: 'Azioni rapide', title: 'Importa movimenti', subtitle: 'Importa estratti e movimenti', href: '/import-estratti', keywords: ['importa', 'importazioni'], icon: Download },
  { id: 'backup', group: 'Azioni rapide', title: 'Crea backup', subtitle: 'Vai a backup e ripristino', href: '/settings#backup', keywords: ['backup', 'ripristino'], icon: DatabaseBackup },
  { id: 'dashboard', group: 'Navigazione', title: 'Dashboard', subtitle: 'Panoramica principale', href: '/dashboard', keywords: ['home', 'dashboard'], icon: LayoutDashboard },
  { id: 'transactions', group: 'Navigazione', title: 'Movimenti', subtitle: 'Transazioni e giroconti', href: '/transactions', keywords: ['transazioni', 'movimenti'], icon: ArrowLeftRight },
  { id: 'accounts', group: 'Navigazione', title: 'Conti', subtitle: 'Risorse e saldi', href: '/accounts', keywords: ['conti', 'risorse'], icon: Wallet },
  { id: 'categories', group: 'Navigazione', title: 'Categorie', subtitle: 'Categorie e sottocategorie', href: '/categories', keywords: ['categorie'], icon: Tag },
  { id: 'budgets', group: 'Navigazione', title: 'Budget', subtitle: 'Budget mensili', href: '/budgets', keywords: ['budget'], icon: Target },
  { id: 'goals', group: 'Navigazione', title: 'Obiettivi', subtitle: 'Obiettivi di risparmio', href: '/goals', keywords: ['obiettivi', 'risparmio'], icon: Target },
  { id: 'reports', group: 'Navigazione', title: 'Report', subtitle: 'Analisi e grafici', href: '/reports', keywords: ['report', 'grafici'], icon: BarChart3 },
  { id: 'loans', group: 'Navigazione', title: 'Prestiti', subtitle: 'Prestiti dati e ricevuti', href: '/loans', keywords: ['prestiti'], icon: HandCoins },
  { id: 'recurring', group: 'Navigazione', title: 'Ricorrenti', subtitle: 'Movimenti ricorrenti', href: '/recurring', keywords: ['ricorrenti', 'abbonamenti'], icon: Repeat },
  { id: 'birthdays', group: 'Navigazione', title: 'Compleanni', subtitle: 'Promemoria compleanni', href: '/birthdays', keywords: ['compleanni'], icon: Cake },
  { id: 'settings', group: 'Navigazione', title: 'Impostazioni', subtitle: 'Profilo, dati, backup', href: '/settings', keywords: ['impostazioni', 'backup'], icon: Settings },
]

function commandScore(query: string, command: QuickCommand): number {
  const q = query.toLowerCase().trim()
  if (!q) return 1
  const haystack = [command.title, command.subtitle, ...command.keywords].join(' ').toLowerCase()
  if (command.title.toLowerCase() === q) return 100
  if (command.title.toLowerCase().startsWith(q)) return 80
  if (haystack.includes(q)) return 50
  return 0
}

function groupItems(items: CommandItem[]) {
  const groups = new Map<string, CommandItem[]>()
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item])
  return [...groups.entries()]
}

export function GlobalCommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { data, loading, error, minQueryLength } = useGlobalSearch(open, query)
  const trimmed = query.trim()

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => { document.body.style.overflow = previousOverflow }
  }, [open])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActiveIndex(0)
    }
  }, [open])

  const items = useMemo<CommandItem[]>(() => {
    const local = quickCommands
      .map((command) => ({ command, score: commandScore(trimmed, command) }))
      .filter(({ score }) => trimmed.length === 0 || score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ command }) => ({
        kind: 'quick' as const,
        id: command.id,
        group: command.group,
        title: command.title,
        subtitle: command.subtitle,
        href: command.href,
        icon: command.icon,
        keywords: command.keywords,
      }))

    const remote = (data?.groups ?? []).flatMap((group: SearchGroup) =>
      group.results.map((result) => ({
        kind: 'result' as const,
        id: `${result.type}-${result.id}`,
        group: group.label,
        result,
        icon: typeIcons[result.type],
      })),
    )

    return trimmed.length < minQueryLength ? local : [...local.slice(0, 5), ...remote]
  }, [data?.groups, minQueryLength, trimmed])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, data])

  useEffect(() => {
    const active = panelRef.current?.querySelector<HTMLElement>(`[data-command-index="${activeIndex}"]`)
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!open) return null

  const selectItem = (item: CommandItem) => {
    const href = item.kind === 'quick' ? item.href : item.result.href
    onOpenChange(false)
    router.push(href)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onOpenChange(false)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, Math.max(items.length - 1, 0)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(Math.max(items.length - 1, 0))
      return
    }
    if (event.key === 'Enter' && items[activeIndex]) {
      event.preventDefault()
      selectItem(items[activeIndex])
    }
  }

  const grouped = groupItems(items)
  const showServerHint = trimmed.length > 0 && trimmed.length < minQueryLength

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Ricerca globale">
      <button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => onOpenChange(false)} aria-label="Chiudi ricerca globale" />
      <div className="absolute inset-x-2 top-4 mx-auto flex max-h-[calc(100vh-2rem)] max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#e5e7f0] bg-white shadow-2xl sm:top-[8vh]">
        <div className="flex items-center gap-3 border-b border-[#e5e7f0] px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Cerca o esegui un’azione…"
            role="combobox"
            aria-expanded="true"
            aria-controls="global-command-results"
            aria-activedescendant={items[activeIndex]?.id}
            className="h-11 min-w-0 flex-1 bg-transparent text-base font-medium text-slate-950 outline-none placeholder:text-slate-400"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />}
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => onOpenChange(false)} aria-label="Chiudi">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div ref={panelRef} id="global-command-results" role="listbox" className="max-h-[70vh] overflow-y-auto p-3">
          {showServerHint && (
            <p className="px-3 py-8 text-center text-sm text-slate-500">Digita almeno 2 caratteri per cercare nei dati di Aurora.</p>
          )}
          {error && (
            <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error === 'SESSION_EXPIRED' ? 'Sessione scaduta. Accedi di nuovo.' : 'Ricerca non riuscita. Riprova.'}
            </p>
          )}
          {!loading && !error && trimmed.length >= minQueryLength && (data?.totalResults ?? 0) === 0 && items.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-slate-500">Nessun risultato per “{trimmed}”. Prova con un nome, una categoria o un importo.</p>
          )}
          {grouped.map(([group, groupItems]) => (
            <section key={group} className="mb-3 last:mb-0">
              <div className="mb-1 flex items-center justify-between px-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{group}</p>
                <span className="text-xs font-medium text-slate-300">{groupItems.length}</span>
              </div>
              <div className="space-y-1">
                {groupItems.map((item) => {
                  const index = items.indexOf(item)
                  const Icon = item.icon
                  const title = item.kind === 'quick' ? item.title : item.result.title
                  const sub = item.kind === 'quick' ? item.subtitle : item.result.subtitle
                  const type = item.kind === 'quick' ? 'Comando' : item.result.type
                  return (
                    <button
                      key={item.id}
                      id={item.id}
                      type="button"
                      data-command-index={index}
                      role="option"
                      aria-selected={activeIndex === index}
                      className={cn('flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition', activeIndex === index ? 'bg-indigo-50 ring-1 ring-indigo-100' : 'hover:bg-slate-50')}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectItem(item)}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-100">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-950">{title}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{type}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{sub}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-[#e5e7f0] px-4 py-2 text-xs text-slate-400">
          <span className="flex items-center gap-1"><Command className="h-3 w-3" /> Ctrl/Cmd K</span>
          <span>↑ ↓ naviga · Invio apri · Esc chiudi</span>
        </div>
      </div>
    </div>
  )
}
