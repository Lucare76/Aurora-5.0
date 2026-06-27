import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles } from 'lucide-react'

export default function SettingsPage() {
  const { user, profile } = useAuth()

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Impostazioni</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profilo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <div className="flex items-center justify-between rounded-xl px-1 py-4 border-b border-white/5">
            <p className="text-sm text-white/40">Nome</p>
            <p className="text-sm font-medium text-white">{profile?.display_name ?? '-'}</p>
          </div>
          <div className="flex items-center justify-between rounded-xl px-1 py-4 border-b border-white/5">
            <p className="text-sm text-white/40">Email</p>
            <p className="text-sm font-medium text-white">{user?.email ?? '-'}</p>
          </div>
          <div className="flex items-center justify-between rounded-xl px-1 py-4">
            <p className="text-sm text-white/40">Valuta predefinita</p>
            <p className="text-sm font-medium text-white">{profile?.currency ?? 'EUR'}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-aurora-purple/3 to-aurora-emerald/3" />
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-aurora-purple" />
            Informazioni
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <p className="gradient-text text-lg font-bold">Aurora 5.0</p>
          <p className="text-xs text-white/35 mt-1">Gestione finanziaria personale</p>
        </CardContent>
      </Card>
    </div>
  )
}
