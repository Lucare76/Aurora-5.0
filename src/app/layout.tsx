import type { Metadata, Viewport } from 'next'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import './globals.css'

export const metadata: Metadata = {
  title: {
    template: '%s | Aurora',
    default: 'Aurora — Gestione finanziaria personale',
  },
  description: 'Aurora è uno strumento personale per monitorare entrate, uscite, budget e patrimonio. I dati sono inseriti manualmente e restano sul tuo account.',
  icons: { icon: '/favicon.svg' },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Aurora',
  },
}

export const viewport: Viewport = {
  themeColor: '#6366f1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  )
}
