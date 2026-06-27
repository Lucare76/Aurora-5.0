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
    <div className="flex items-center gap-3 px-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
        <Sparkles className="h-5 w-5" />
      </div>
      <span className="text-lg font-semibold tracking-normal text-foreground">Aurora</span>
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
              'group flex h-10 items-center gap-3 rounded-md border-l-2 px-3 text-sm font-medium transition-colors',
              isActive
                ? 'border-primary bg-accent text-primary'
                : 'border-transparent text-muted-foreground hover:bg-accent/70 hover:text-foreground'
            )
          }
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{item.label}</span>
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
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-3 rounded-lg bg-muted/70 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {initials || 'AU'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
          {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
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
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-16 items-center border-b border-border">
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
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-border bg-card lg:block">
        <SidebarContent
          displayName={displayName}
          email={user?.email}
          onSignOut={handleSignOut}
        />
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur lg:hidden">
        <Logo />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
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
            className="absolute inset-0 bg-black/70"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Chiudi menu"
          />
          <aside className="relative h-full w-72 max-w-[86vw] border-r border-border bg-card shadow-2xl">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 z-10 text-muted-foreground hover:text-foreground"
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

      <div className="min-h-screen pt-16 lg:ml-60 lg:pt-0">
        <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="grid h-16 grid-cols-5">
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn(
                  'flex min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="w-full truncate text-center">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
