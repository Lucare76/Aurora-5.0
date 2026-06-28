'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { Sparkles } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'

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
  const { loading, signUp } = useAuth()
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema) as never,
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const onSubmit = async (values: RegisterForm) => {
    try {
      await signUp(values.email, values.password, values.displayName)
      toast.success('Account creato. Benvenuto in Aurora.')
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Registrazione non riuscita. Riprova.'
      toast.error(message)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="relative h-12 w-12 animate-pulse rounded-xl bg-gradient-to-br from-aurora-purple to-aurora-emerald">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-aurora-purple to-aurora-emerald opacity-30 blur-xl" />
        </div>
      </div>
    )
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="aurora-bg-intense" />

      <div className="relative z-10 w-full max-w-md animate-scale-in">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="relative mb-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-aurora-purple via-aurora-violet to-aurora-emerald shadow-xl shadow-aurora-purple/20">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-aurora-purple to-aurora-emerald opacity-20 blur-2xl" />
          </div>
          <h1 className="gradient-text text-4xl font-bold tracking-tight">Aurora</h1>
          <p className="mt-3 text-sm text-slate-500">Crea il tuo sistema personale</p>
        </div>

        <div className="glass-card rounded-2xl p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Crea account</h2>
            <p className="mt-1 text-sm text-slate-500">
              Prepareremo automaticamente le categorie iniziali.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-slate-600">Nome</Label>
              <Input id="displayName" autoComplete="name" placeholder="Il tuo nome" className="h-11 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-indigo-200" {...register('displayName')} />
              {errors.displayName && <p className="text-sm text-danger">{errors.displayName.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-600">Email</Label>
              <Input id="email" type="email" autoComplete="email" placeholder="nome@esempio.it" className="h-11 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-indigo-200" {...register('email')} />
              {errors.email && <p className="text-sm text-danger">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-600">Password</Label>
              <Input id="password" type="password" autoComplete="new-password" placeholder="Almeno 6 caratteri" className="h-11 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-indigo-200" {...register('password')} />
              {errors.password && <p className="text-sm text-danger">{errors.password.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-600">Conferma password</Label>
              <Input id="confirmPassword" type="password" autoComplete="new-password" placeholder="Ripeti la password" className="h-11 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-indigo-200" {...register('confirmPassword')} />
              {errors.confirmPassword && <p className="text-sm text-danger">{errors.confirmPassword.message}</p>}
            </div>

            <Button type="submit" className="h-12 w-full text-base" disabled={isSubmitting}>
              {isSubmitting ? 'Creazione in corso...' : 'Registrati'}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            Hai già un account?{' '}
            <Link className="font-medium text-indigo-600 transition-colors hover:text-indigo-500" href="/login">
              Accedi
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
