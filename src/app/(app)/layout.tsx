'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowLeftRight,
  BarChart3,
  Cake,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  PiggyBank,
  Repeat,
  Settings,
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
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/transactions', label: 'Movimenti', icon: ArrowLeftRight },
  { path: '/accounts', label: 'Conti', icon: Wallet },
  { path: '/categories', label: 'Categorie', icon: Tag },
  { path: '/budgets', label: 'Budget', icon: Target },
  { path: '/goals', label: 'Obiettivi', icon: PiggyBank },
  { path: '/reports', label: 'Report', icon: BarChart3 },
  { path: '/recurring', label: 'Ricorrenti', icon: Repeat },
  { path: '/loans', label: 'Prestiti', icon: HandCoins },
  { path: '/birthdays', label: 'Compleanni', icon: Cake },
  { path: '/settings', label: 'Impostazioni', icon: Settings },
]

const bottomNavItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/transactions', label: 'Movimenti', icon: ArrowLeftRight },
  { path: '/accounts', label: 'Conti', icon: Wallet },
  { path: '/budgets', label: 'Budget', icon: Target },
]

const moreItems: NavItem[] = [
  { path: '/goals', label: 'Obiettivi', icon: PiggyBank },
  { path: '/categories', label: 'Categorie', icon: Tag },
  { path: '/reports', label: 'Report', icon: BarChart3 },
  { path: '/recurring', label: 'Ricorrenti', icon: Repeat },
  { path: '/loans', label: 'Prestiti', icon: HandCoins },
  { path: '/birthdays', label: 'Compleanni', icon: Cake },
  { path: '/settings', label: 'Impostazioni', icon: Settings },
]

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

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="space-y-1 px-3">
      {navItems.map((item) => {
        const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`)

        return (
          <Link
            key={item.path}
            href={item.path}
            onClick={onNavigate}
            className={cn(
              'group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all duration-200',
              isActive
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
            )}
          >
            {isActive && <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-indigo-600" />}
            <item.icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-indigo-600' : 'text-slate-400')} />
            <span className="truncate">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function UserFooter({
  displayName,
  email,
  onSignOut,
}: {
  displayName: string
  email?: string
  onSignOut: () => void
}) {
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="border-t border-[#e5e7f0] p-3">
      <div className="flex items-center gap-3 rounded-2xl bg-[#f8f9fc] p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-sm font-bold text-white">
          {initials || 'AU'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
          {email && <p className="truncate text-xs text-slate-400">{email}</p>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-slate-400 hover:bg-white hover:text-slate-700"
          onClick={onSignOut}
          aria-label="Esci"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function SidebarContent({
  displayName,
  email,
  onSignOut,
  onNavigate,
  onSearchOpen,
}: {
  displayName: string
  email?: string
  onSignOut: () => void
  onNavigate?: () => void
  onSearchOpen: () => void
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-[#e5e7f0]">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <GlobalSearchTrigger onClick={onSearchOpen} />
        <Navigation onNavigate={onNavigate} />
      </div>
      <UserFooter displayName={displayName} email={email} onSignOut={onSignOut} />
    </div>
  )
}

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Chiudi altro"
      />
      <div className="absolute inset-x-0 bottom-0 rounded-t-[2rem] border border-[#e5e7f0] bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200" />
        <div className="mb-3 flex items-center justify-between px-1">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-400">Altro</p>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={onClose} aria-label="Chiudi">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid gap-2">
          {moreItems.map((item) => {
            const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`)

            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold',
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                <item.icon className={cn('h-5 w-5', isActive ? 'text-indigo-600' : 'text-slate-400')} />
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const { profile, user, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Utente Aurora'
  const isMoreActive = moreItems.some((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
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
    <div className="min-h-screen bg-[#f8f9fc] text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-[#e5e7f0] bg-white md:block">
        <SidebarContent displayName={displayName} email={user?.email} onSignOut={handleSignOut} onSearchOpen={() => setCommandOpen(true)} />
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-[#e5e7f0] bg-white/90 px-4 backdrop-blur md:hidden">
        <Logo compact />
        <div className="flex items-center gap-1">
          <GlobalSearchTrigger compact onClick={() => setCommandOpen(true)} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-slate-600 hover:bg-slate-100"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Apri menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div
        className={cn(
          'fixed inset-0 z-50 transition md:hidden',
          mobileMenuOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
      >
        <button
          type="button"
          className={cn(
            'absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] transition-opacity',
            mobileMenuOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Chiudi menu"
        />
        <aside
          className={cn(
            'relative h-full w-72 max-w-[86vw] border-r border-[#e5e7f0] bg-white shadow-2xl transition-transform duration-300 ease-out',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 z-10 h-9 w-9 text-slate-400 hover:text-slate-700"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Chiudi menu"
          >
            <X className="h-5 w-5" />
          </Button>
          <SidebarContent
            displayName={displayName}
            email={user?.email}
            onSignOut={handleSignOut}
            onSearchOpen={() => setCommandOpen(true)}
            onNavigate={() => setMobileMenuOpen(false)}
          />
        </aside>
      </div>

      <div className="min-h-screen pt-16 md:ml-60 md:pt-0">
        <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-24 sm:px-6 md:px-8 md:py-8 md:pb-8">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e5e7f0] bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_rgba(15,23,42,0.06)] backdrop-blur md:hidden">
        <div className="grid h-16 grid-cols-5">
          {bottomNavItems.map((item) => {
            const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`)

            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  'flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold transition-colors',
                  isActive ? 'text-indigo-600' : 'text-slate-400',
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="w-full truncate text-center">{item.label}</span>
              </Link>
            )
          })}
          <button
            type="button"
            className={cn(
              'flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold transition-colors',
              isMoreActive || moreOpen ? 'text-indigo-600' : 'text-slate-400',
            )}
            onClick={() => setMoreOpen(true)}
            aria-label="Apri altro"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="w-full truncate text-center">Altro</span>
          </button>
        </div>
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
      <GlobalCommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  )
}
