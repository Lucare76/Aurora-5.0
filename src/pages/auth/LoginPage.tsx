import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { Sparkles } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'

const loginSchema = z.object({
  email: z.string().trim().email('Inserisci un indirizzo email valido.'),
  password: z.string().min(1, 'Inserisci la password.'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true })
    }
  }, [loading, navigate, user])

  const onSubmit = async (values: LoginForm) => {
    try {
      await signIn(values.email, values.password)
      navigate('/', { replace: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Accesso non riuscito. Riprova.'
      toast.error(message)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="h-10 w-10 animate-pulse rounded-lg bg-primary/25" />
      </div>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary shadow-lg shadow-primary/10">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-semibold tracking-normal text-foreground">Aurora</h1>
          <p className="mt-2 text-sm text-muted-foreground">Accedi al tuo spazio finanziario.</p>
        </div>

        <Card className="border-border bg-card shadow-2xl shadow-black/20">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Bentornato</CardTitle>
            <CardDescription>Usa email e password per continuare.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nome@esempio.it"
                  {...register('email')}
                />
                {errors.email && <p className="text-sm text-danger">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="La tua password"
                  {...register('password')}
                />
                {errors.password && <p className="text-sm text-danger">{errors.password.message}</p>}
              </div>

              <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Accesso in corso...' : 'Accedi'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Non hai ancora un account?{' '}
              <Link className="font-medium text-primary hover:underline" to="/register">
                Registrati
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
