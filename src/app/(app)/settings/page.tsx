'use client'

import { Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'

export default function SettingsPage() {
  const { user, profile } = useAuth()

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Impostazioni</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profilo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <div className="flex items-center justify-between rounded-xl border-b border-slate-200/60 px-1 py-4">
            <p className="text-sm text-slate-500">Nome</p>
            <p className="text-sm font-medium text-slate-900">
              {profile?.display_name ?? '-'}
            </p>
          </div>
          <div className="flex items-center justify-between rounded-xl border-b border-slate-200/60 px-1 py-4">
            <p className="text-sm text-slate-500">Email</p>
            <p className="text-sm font-medium text-slate-900">{user?.email ?? '-'}</p>
          </div>
          <div className="flex items-center justify-between rounded-xl px-1 py-4">
            <p className="text-sm text-slate-500">Valuta predefinita</p>
            <p className="text-sm font-medium text-slate-900">
              {profile?.currency ?? 'EUR'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/80 to-emerald-50/60" />
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            Informazioni
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <p className="gradient-text text-lg font-bold">Aurora 5.0</p>
          <p className="mt-1 text-xs text-slate-400">Gestione finanziaria personale</p>
        </CardContent>
      </Card>
    </div>
  )
}
