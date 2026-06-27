import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  Cake,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
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
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/transactions', label: 'Transazioni', icon: ArrowLeftRight },
  { path: '/accounts', label: 'Conti', icon: Wallet },
  { path: '/categories', label: 'Categorie', icon: Tag },
  { path: '/budgets', label: 'Budget', icon: Target },
  { path: '/recurring', label: 'Ricorrenti', icon: Repeat },
  { path: '/loans', label: 'Prestiti', icon: HandCoins },
  { path: '/birthdays', label: 'Compleanni', icon: Cake },
  { path: '/settings', label: 'Impostazioni', icon: Settings },
]

const bottomNavItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/transactions', label: 'Transazioni', icon: ArrowLeftRight },
  { path: '/accounts', label: 'Conti', icon: Wallet },
  { path: '/budgets', label: 'Budget', icon: Target },
  { path: '/settings', label: 'Altro', icon: Settings },
]

function Logo() {
  return (
    <div className="flex items-center gap-3 px-5">
      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-aurora-purple via-aurora-violet to-aurora-emerald shadow-lg shadow-aurora-purple/25">
        <Sparkles className="h-5 w-5 text-white" />
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-aurora-purple via-aurora-violet to-aurora-emerald opacity-40 blur-lg" />
      </div>
      <span className="gradient-text text-xl font-bold tracking-tight">Aurora</span>
    </div>
  )
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-1 px-3">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-white/8 text-white shadow-sm'
                : 'text-white/50 hover:bg-white/5 hover:text-white/80'
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <div className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-aurora-purple to-aurora-emerald" />
              )}
              <item.icon className={cn('h-4 w-4 shrink-0 transition-colors', isActive && 'text-aurora-purple')} />
              <span className="truncate">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
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
    <div className="border-t border-white/5 p-3">
      <div className="flex items-center gap-3 rounded-xl bg-white/3 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-aurora-purple to-aurora-violet text-sm font-bold text-white shadow-md shadow-aurora-purple/20">
          {initials || 'AU'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white/90">{displayName}</p>
          {email && <p className="truncate text-xs text-white/40">{email}</p>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-white/30 hover:bg-white/5 hover:text-white/60"
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
}: {
  displayName: string
  email?: string
  onSignOut: () => void
  onNavigate?: () => void
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-white/5">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <Navigation onNavigate={onNavigate} />
      </div>
      <UserFooter displayName={displayName} email={email} onSignOut={onSignOut} />
    </div>
  )
}

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Utente Aurora'

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="aurora-bg" />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <div className="flex h-full flex-col border-r border-white/5 bg-[#0a0c18]/80 backdrop-blur-xl">
          <SidebarContent
            displayName={displayName}
            email={user?.email}
            onSignOut={handleSignOut}
          />
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-white/5 bg-background/80 px-4 backdrop-blur-xl lg:hidden">
        <Logo />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-white/50 hover:text-white"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Apri menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Chiudi menu"
          />
          <aside className="relative h-full w-72 max-w-[86vw] border-r border-white/5 bg-[#0a0c18]/95 shadow-2xl shadow-black/50 backdrop-blur-xl">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 z-10 text-white/40 hover:text-white"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Chiudi menu"
            >
              <X className="h-5 w-5" />
            </Button>
            <SidebarContent
              displayName={displayName}
              email={user?.email}
              onSignOut={handleSignOut}
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="relative min-h-screen pt-16 lg:ml-64 lg:pt-0">
        <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-[#0a0c18]/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="grid h-16 grid-cols-5">
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn(
                  'flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition-all duration-200',
                  isActive ? 'text-aurora-purple' : 'text-white/35 hover:text-white/60'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <item.icon className="h-5 w-5 shrink-0" />
                    {isActive && (
                      <div className="absolute -inset-1 rounded-full bg-aurora-purple/20 blur-md" />
                    )}
                  </div>
                  <span className="w-full truncate text-center">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
