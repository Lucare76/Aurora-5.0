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

const registerSchema = z
  .object({
    displayName: z.string().trim().min(2, 'Inserisci almeno 2 caratteri.'),
    email: z.string().trim().email('Inserisci un indirizzo email valido.'),
    password: z.string().min(6, 'La password deve avere almeno 6 caratteri.'),
    confirmPassword: z.string().min(1, 'Conferma la password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Le password non corrispondono.',
    path: ['confirmPassword'],
  })

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const { user, loading, signUp } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true })
    }
  }, [loading, navigate, user])

  const onSubmit = async (values: RegisterForm) => {
    try {
      await signUp(values.email, values.password, values.displayName)
      toast.success('Account creato. Benvenuto in Aurora.')
      navigate('/', { replace: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registrazione non riuscita. Riprova.'
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
          <p className="mt-2 text-sm text-muted-foreground">Crea il tuo sistema personale.</p>
        </div>

        <Card className="border-border bg-card shadow-2xl shadow-black/20">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Crea account</CardTitle>
            <CardDescription>Prepareremo automaticamente le categorie iniziali.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <Label htmlFor="displayName">Nome</Label>
                <Input
                  id="displayName"
                  autoComplete="name"
                  placeholder="Il tuo nome"
                  {...register('displayName')}
                />
                {errors.displayName && <p className="text-sm text-danger">{errors.displayName.message}</p>}
              </div>

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
                  autoComplete="new-password"
                  placeholder="Almeno 6 caratteri"
                  {...register('password')}
                />
                {errors.password && <p className="text-sm text-danger">{errors.password.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Conferma password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Ripeti la password"
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-danger">{errors.confirmPassword.message}</p>
                )}
              </div>

              <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Creazione in corso...' : 'Registrati'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Hai gia un account?{' '}
              <Link className="font-medium text-primary hover:underline" to="/login">
                Accedi
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
