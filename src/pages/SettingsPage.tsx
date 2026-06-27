import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default function SettingsPage() {
  const { user, profile } = useAuth()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Impostazioni</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profilo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Nome</p>
            <p className="text-sm font-medium">{profile?.display_name ?? '-'}</p>
          </div>
          <Separator />
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="text-sm font-medium">{user?.email ?? '-'}</p>
          </div>
          <Separator />
          <div>
            <p className="text-sm text-muted-foreground">Valuta predefinita</p>
            <p className="text-sm font-medium">{profile?.currency ?? 'EUR'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informazioni</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Aurora 5.0</p>
          <p className="text-xs text-muted-foreground mt-1">Gestione finanziaria personale</p>
        </CardContent>
      </Card>
    </div>
  )
}
