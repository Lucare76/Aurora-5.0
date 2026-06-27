import { useState } from 'react'
import { Outlet, useNavigate, NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  PiggyBank,
  Settings,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAuth } from '@/hooks/useAuth'

const bottomNavItems = [
  { path: '/', label: 'Home', icon: LayoutDashboard },
  { path: '/transactions', label: 'Transazioni', icon: ArrowLeftRight },
  { path: '/accounts', label: 'Conti', icon: Wallet },
  { path: '/budgets', label: 'Budget', icon: PiggyBank },
  { path: '/settings', label: 'Altro', icon: Settings },
]

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar onSignOut={handleSignOut} displayName={profile?.display_name} />

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/80" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-60 h-full bg-card border-r">
            <div className="flex justify-end p-2">
              <button onClick={() => setMobileMenuOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <Sidebar onSignOut={handleSignOut} displayName={profile?.display_name} />
          </div>
        </div>
      )}

      <div className="lg:ml-60">
        <Header onMenuToggle={() => setMobileMenuOpen(true)} />

        <main className="max-w-[1200px] mx-auto px-4 py-6 lg:px-6 pb-20 lg:pb-6">
          <Outlet />
        </main>

        <nav className="lg:hidden fixed bottom-0 left-0 right-0 border-t bg-card z-40">
          <div className="flex items-center justify-around py-2">
            {bottomNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 px-3 py-1 text-xs transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
