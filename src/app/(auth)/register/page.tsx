'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { Sparkles } from 'lucide-react'
import { useForm } from 'react-hook-form'
import type { SubmitHandler } from 'react-hook-form'
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
  const { user, loading, signUp } = useAuth()
  const [formError, setFormError] = useState('')
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema) as any,
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard')
    }
  }, [loading, router, user])

  const onSubmit: SubmitHandler<RegisterForm> = async (values) => {
    setFormError('')
    try {
      await signUp(values.email, values.password, values.displayName)
      router.replace('/dashboard')
      router.refresh()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Registrazione non riuscita. Riprova.')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f9fc] p-0 sm:p-6">
      <section className="flex min-h-screen w-full max-w-[420px] flex-col justify-center bg-white p-8 shadow-lg sm:min-h-0 sm:rounded-2xl sm:p-10">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950">Aurora</h1>
          <p className="mt-2 text-sm text-slate-500">Crea il tuo sistema finanziario personale.</p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-sm font-semibold text-slate-700">Nome</Label>
            <Input
              id="displayName"
              autoComplete="name"
              placeholder="Il tuo nome"
              className="h-12 rounded-xl border-[#e5e7f0] bg-white text-slate-950 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-500/30"
              {...register('displayName')}
            />
            {errors.displayName && <p className="text-sm text-red-500">{errors.displayName.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-semibold text-slate-700">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nome@esempio.it"
              className="h-12 rounded-xl border-[#e5e7f0] bg-white text-slate-950 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-500/30"
              {...register('email')}
            />
            {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-semibold text-slate-700">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Almeno 6 caratteri"
              className="h-12 rounded-xl border-[#e5e7f0] bg-white text-slate-950 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-500/30"
              {...register('password')}
            />
            {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-700">Conferma password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Ripeti la password"
              className="h-12 rounded-xl border-[#e5e7f0] bg-white text-slate-950 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-500/30"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
          </div>

          {formError && (
            <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {formError}
            </p>
          )}

          <Button type="submit" className="h-12 w-full rounded-xl bg-indigo-600 text-base font-semibold hover:bg-indigo-700" disabled={isSubmitting || loading}>
            {isSubmitting ? 'Creazione in corso...' : 'Registrati'}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-500">
          Hai già un account?{' '}
          <Link className="font-semibold text-indigo-600 hover:text-indigo-700" href="/login">
            Accedi
          </Link>
        </p>
      </section>
    </main>
  )
}
