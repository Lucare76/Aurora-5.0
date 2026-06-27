import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Tags,
  PiggyBank,
  Repeat,
  HandCoins,
  Cake,
  Settings,
  LogOut,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/transactions', label: 'Transazioni', icon: ArrowLeftRight },
  { path: '/accounts', label: 'Conti', icon: Wallet },
  { path: '/categories', label: 'Categorie', icon: Tags },
  { path: '/budgets', label: 'Budget', icon: PiggyBank },
  { path: '/recurring', label: 'Ricorrenti', icon: Repeat },
  { path: '/loans', label: 'Prestiti', icon: HandCoins },
  { path: '/birthdays', label: 'Compleanni', icon: Cake },
  { path: '/settings', label: 'Impostazioni', icon: Settings },
]

interface SidebarProps {
  onSignOut: () => void
  displayName?: string
}

export function Sidebar({ onSignOut, displayName }: SidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col w-60 border-r bg-card h-screen fixed left-0 top-0">
      <div className="flex items-center gap-2 px-6 py-5">
        <Sparkles className="h-6 w-6 text-primary" />
        <span className="text-xl font-bold">Aurora</span>
      </div>

      <Separator />

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Separator />

      <div className="p-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground truncate">
          {displayName ?? 'Utente'}
        </span>
        <button
          onClick={onSignOut}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  )
}
