'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Activity,
  ArrowLeftRight,
  BadgeEuro,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Cake,
  CalendarClock,
  CalendarDays,
  FlaskConical,
  HandCoins,
  History,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  PiggyBank,
  Repeat,
  ScanSearch,
  Settings,
  ShoppingCart,
  Sparkles,
  Tag,
  Target,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlobalCommandMenu } from '@/components/global-command-menu'
import { GlobalSearchTrigger } from '@/components/global-search-trigger'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
}

export type NavGroup = {
  key: string
  label: string
  items: NavItem[]
}

const PRIVATE_FINANCE_PATHS = new Set(['/aurora', '/adi'])
const PRIVATE_HR_PATHS = new Set(['/leave', '/deadlines', '/timeline'])

const bottomNavItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/transactions', label: 'Movimenti', icon: ArrowLeftRight },
  { path: '/accounts', label: 'Conti', icon: Wallet },
  { path: '/budgets', label: 'Budget', icon: Target },
]

function assistantNavItems(financialAssistantEnabled: boolean): NavItem[] {
  return financialAssistantEnabled ? [{ path: '/assistant', label: 'Chiedi ad Aurora', icon: MessageCircle }] : []
}

function buildAllGroups(financialAssistantEnabled: boolean): NavGroup[] {
  return [
    {
      key: 'home',
      label: 'Panoramica',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ...assistantNavItems(financialAssistantEnabled),
      ],
    },
    {
      key: 'money',
      label: 'Gestione denaro',
      items: [
        { path: '/transactions', label: 'Movimenti', icon: ArrowLeftRight },
        { path: '/accounts', label: 'Conti', icon: Wallet },
        { path: '/patrimonio', label: 'Patrimonio', icon: Landmark },
        { path: '/categories', label: 'Categorie', icon: Tag },
        { path: '/budgets', label: 'Budget', icon: Target },
        { path: '/goals', label: 'Obiettivi', icon: PiggyBank },
      ],
    },
    {
      key: 'analysis',
      label: 'Analisi e decisioni',
      items: [
        { path: '/reports', label: 'Report', icon: BarChart3 },
        { path: '/financial-health', label: 'Salute finanziaria', icon: Activity },
        { path: '/scenarios', label: 'Scenari', icon: FlaskConical },
        { path: '/affordability', label: 'Permettermelo?', icon: ShoppingCart },
      ],
    },
    {
      key: 'planning',
      label: 'Pianificazione',
      items: [
        { path: '/calendar', label: 'Calendario', icon: CalendarDays },
        { path: '/recurring', label: 'Ricorrenti', icon: Repeat },
        { path: '/loans', label: 'Prestiti', icon: HandCoins },
        { path: '/automation', label: 'Automazioni', icon: Sparkles },
      ],
    },
    {
      key: 'personal',
      label: 'Aree personali',
      items: [
        { path: '/aurora', label: 'Risparmi Aurora', icon: PiggyBank },
        { path: '/adi', label: 'Gestione ADI', icon: BadgeEuro },
        { path: '/leave', label: 'Ferie e permessi', icon: BriefcaseBusiness },
        { path: '/deadlines', label: 'Scadenze', icon: CalendarClock },
        { path: '/timeline', label: 'Timeline', icon: History },
        { path: '/birthdays', label: 'Compleanni', icon: Cake },
      ],
    },
    {
      key: 'system',
      label: 'Sistema',
      items: [
        { path: '/notifications', label: 'Avvisi', icon: Bell },
        { path: '/data-integrity', label: 'Integrità dati', icon: ScanSearch },
        { path: '/settings', label: 'Impostazioni', icon: Settings },
      ],
    },
  ]
}

export function filterPrivateFinanceNavItems(items: NavItem[], canAccessPrivateFinance: boolean): NavItem[] {
  if (canAccessPrivateFinance) return items
  return items.filter((item) => !PRIVATE_FINANCE_PATHS.has(item.path))
}

export function filterPrivateHrNavItems(items: NavItem[], canAccessPrivateHr: boolean): NavItem[] {
  if (canAccessPrivateHr) return items
  return items.filter((item) => !PRIVATE_HR_PATHS.has(item.path))
}

function filterPrivateNavItems(items: NavItem[], canAccessPrivateFinance: boolean, canAccessPrivateHr: boolean): NavItem[] {
  return filterPrivateHrNavItems(filterPrivateFinanceNavItems(items, canAccessPrivateFinance), canAccessPrivateHr)
}

export function getNavGroups(
  canAccessPrivateFinance: boolean,
  financialAssistantEnabled = false,
  canAccessPrivateHr = false,
): NavGroup[] {
  return buildAllGroups(financialAssistantEnabled)
    .map((group) => ({
      ...group,
      items: filterPrivateNavItems(group.items, canAccessPrivateFinance, canAccessPrivateHr),
    }))
    .filter((group) => group.items.length > 0)
}

export function getNavItems(canAccessPrivateFinance: boolean, financialAssistantEnabled = false, canAccessPrivateHr = false): NavItem[] {
  return getNavGroups(canAccessPrivateFinance, financialAssistantEnabled, canAccessPrivateHr).flatMap((group) => group.items)
}

export function getMoreItems(canAccessPrivateFinance: boolean, financialAssistantEnabled = false, canAccessPrivateHr = false): NavItem[] {
  const bottomPaths = new Set(bottomNavItems.map((item) => item.path))
  return getNavItems(canAccessPrivateFinance, financialAssistantEnabled, canAccessPrivateHr).filter((item) => !bottomPaths.has(item.path))
}

function itemIsActive(pathname: string, item: NavItem): boolean {
  return pathname === item.path || pathname.startsWith(`${item.path}/`)
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className={cn('flex items-center gap-3', compact ? '' : 'px-5')}>
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25">
        <Sparkles className="h-5 w-5" />
      </div>
      <span className="text-xl font-bold tracking-tight text-slate-950">Aurora</span>
    </Link>
  )
}

function Navigation({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="space-y-5 px-3" aria-label="Navigazione principale">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`nav-${group.key}`}>
          <p id={`nav-${group.key}`} className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const isActive = itemIsActive(pathname, item)
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={onNavigate}
                  className={cn(
                    'group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all duration-200',
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
                  )}
                >
                  {isActive && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-indigo-600" />}
                  <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-indigo-600' : 'text-slate-400')} />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </nav>
  )
}

function UserFooter({ displayName, email, onSignOut }: { displayName: string; email?: string; onSignOut: () => void }) {
  const initials = displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="border-t border-[#e5e7f0] p-3">
      <div className="flex items-center gap-3 rounded-2xl bg-[#f8f9fc] p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-sm font-bold text-white">{initials || 'AU'}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
          {email && <p className="truncate text-xs text-slate-400">{email}</p>}
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-slate-400 hover:bg-white hover:text-slate-700" onClick={onSignOut} aria-label="Esci">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function SidebarContent({ displayName, email, onSignOut, onNavigate, onSearchOpen, groups }: {
  displayName: string
  email?: string
  onSignOut: () => void
  onNavigate?: () => void
  onSearchOpen: () => void
  groups: NavGroup[]
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-[#e5e7f0] pr-3">
        <Logo />
        <NotificationBell />
      </div>
      <div className="flex-1 overflow-y-auto py-4 [scrollbar-width:thin]">
        <GlobalSearchTrigger onClick={onSearchOpen} />
        <Navigation groups={groups} onNavigate={onNavigate} />
      </div>
      <UserFooter displayName={displayName} email={email} onSignOut={onSignOut} />
    </div>
  )
}

function MoreSheet({ open, groups, onClose }: { open: boolean; groups: NavGroup[]; onClose: () => void }) {
  const pathname = usePathname()
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button type="button" className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" onClick={onClose} aria-label="Chiudi altro" />
      <div className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto overflow-x-hidden rounded-t-[2rem] border border-[#e5e7f0] bg-white p-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] min-[360px]:p-4 min-[360px]:pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200" />
        <div className="sticky top-0 z-10 mb-4 flex items-center justify-between bg-white px-1 py-1">
          <div>
            <p className="text-base font-bold text-slate-900">Tutte le sezioni</p>
            <p className="text-xs text-slate-400">Organizzate per area</p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={onClose} aria-label="Chiudi"><X className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.key}>
              <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{group.label}</p>
              <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
                {group.items.map((item) => {
                  const isActive = itemIsActive(pathname, item)
                  return (
                    <Link key={item.path} href={item.path} onClick={onClose} className={cn(
                      'flex min-h-14 items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors',
                      isActive ? 'border-indigo-100 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-slate-50/70 text-slate-600 hover:bg-slate-100',
                    )}>
                      <item.icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-indigo-600' : 'text-slate-400')} />
                      <span className="min-w-0 truncate">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AppLayoutClient({ children, canAccessPrivateFinance, canAccessPrivateHr, financialAssistantEnabled }: {
  children: React.ReactNode
  canAccessPrivateFinance: boolean
  canAccessPrivateHr: boolean
  financialAssistantEnabled: boolean
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const { profile, user, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Utente Aurora'
  const navGroups = useMemo(
    () => getNavGroups(canAccessPrivateFinance, financialAssistantEnabled, canAccessPrivateHr),
    [canAccessPrivateFinance, canAccessPrivateHr, financialAssistantEnabled],
  )
  const moreGroups = useMemo(() => {
    const bottomPaths = new Set(bottomNavItems.map((item) => item.path))
    return navGroups.map((group) => ({ ...group, items: group.items.filter((item) => !bottomPaths.has(item.path)) })).filter((group) => group.items.length > 0)
  }, [navGroups])
  const isMoreActive = moreGroups.some((group) => group.items.some((item) => itemIsActive(pathname, item)))

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isSearchShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'
      if (!isSearchShortcut || event.altKey || event.shiftKey) return
      event.preventDefault()
      setCommandOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f8f9fc] text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-[#e5e7f0] bg-white md:block">
        <SidebarContent displayName={displayName} email={user?.email} onSignOut={handleSignOut} onSearchOpen={() => setCommandOpen(true)} groups={navGroups} />
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex h-16 min-w-0 items-center justify-between border-b border-[#e5e7f0] bg-white/90 px-3 backdrop-blur min-[360px]:px-4 md:hidden">
        <Logo compact />
        <div className="flex items-center gap-1">
          <GlobalSearchTrigger compact onClick={() => setCommandOpen(true)} />
          <NotificationBell />
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-slate-600 hover:bg-slate-100" onClick={() => setMobileMenuOpen(true)} aria-label="Apri menu">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className={cn('fixed inset-0 z-50 transition md:hidden', mobileMenuOpen ? 'pointer-events-auto' : 'pointer-events-none')}>
        <button type="button" className={cn('absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] transition-opacity', mobileMenuOpen ? 'opacity-100' : 'opacity-0')} onClick={() => setMobileMenuOpen(false)} aria-label="Chiudi menu" />
        <aside className={cn('relative h-full w-80 max-w-[88vw] border-r border-[#e5e7f0] bg-white shadow-2xl transition-transform duration-300 ease-out', mobileMenuOpen ? 'translate-x-0' : '-translate-x-full')}>
          <Button type="button" variant="ghost" size="icon" className="absolute right-3 top-3 z-10 h-9 w-9 text-slate-400 hover:text-slate-700" onClick={() => setMobileMenuOpen(false)} aria-label="Chiudi menu"><X className="h-5 w-5" /></Button>
          <SidebarContent displayName={displayName} email={user?.email} onSignOut={handleSignOut} onSearchOpen={() => setCommandOpen(true)} onNavigate={() => setMobileMenuOpen(false)} groups={navGroups} />
        </aside>
      </div>

      <div className="min-h-screen min-w-0 pt-16 md:ml-64 md:pt-0">
        <main className="mx-auto w-full min-w-0 max-w-7xl px-3 py-5 pb-24 min-[360px]:px-4 min-[360px]:py-6 sm:px-6 md:px-8 md:py-8 md:pb-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 overflow-x-hidden border-t border-[#e5e7f0] bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_rgba(15,23,42,0.06)] backdrop-blur min-[360px]:px-2 md:hidden">
        <div className="grid h-16 grid-cols-5">
          {bottomNavItems.map((item) => {
            const isActive = itemIsActive(pathname, item)
            return (
              <Link key={item.path} href={item.path} className={cn('flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold transition-colors', isActive ? 'text-indigo-600' : 'text-slate-400')}>
                <item.icon className="h-5 w-5" />
                <span className="hidden w-full truncate text-center min-[340px]:block">{item.label}</span>
              </Link>
            )
          })}
          <button type="button" className={cn('flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold transition-colors', isMoreActive || moreOpen ? 'text-indigo-600' : 'text-slate-400')} onClick={() => setMoreOpen(true)} aria-label="Apri altro">
            <MoreHorizontal className="h-5 w-5" />
            <span className="hidden w-full truncate text-center min-[340px]:block">Altro</span>
          </button>
        </div>
      </nav>

      <MoreSheet open={moreOpen} groups={moreGroups} onClose={() => setMoreOpen(false)} />
      <GlobalCommandMenu open={commandOpen} onOpenChange={setCommandOpen} canAccessPrivateFinance={canAccessPrivateFinance} canAccessPrivateHr={canAccessPrivateHr} financialAssistantEnabled={financialAssistantEnabled} />
    </div>
  )
}
