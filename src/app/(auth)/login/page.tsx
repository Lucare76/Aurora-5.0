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

const loginSchema = z.object({
  email: z.string().trim().email('Inserisci un indirizzo email valido.'),
  password: z.string().min(1, 'Inserisci la password.'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { user, loading, signIn } = useAuth()
  const [formError, setFormError] = useState('')
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema) as any,
    defaultValues: { email: '', password: '' },
  })

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard')
    }
  }, [loading, router, user])

  const onSubmit: SubmitHandler<LoginForm> = async (values) => {
    setFormError('')
    try {
      await signIn(values.email, values.password)
      router.replace('/dashboard')
      router.refresh()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Accesso non riuscito. Riprova.')
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
          <p className="mt-2 text-sm text-slate-500">Accedi al tuo spazio finanziario personale.</p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)}>
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
              autoComplete="current-password"
              placeholder="La tua password"
              className="h-12 rounded-xl border-[#e5e7f0] bg-white text-slate-950 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-500/30"
              {...register('password')}
            />
            {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
          </div>

          {formError && (
            <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {formError}
            </p>
          )}

          <Button type="submit" className="h-12 w-full rounded-xl bg-indigo-600 text-base font-semibold hover:bg-indigo-700" disabled={isSubmitting || loading}>
            {isSubmitting ? 'Accesso in corso...' : 'Accedi'}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-500">
          Non hai ancora un account?{' '}
          <Link className="font-semibold text-indigo-600 hover:text-indigo-700" href="/register">
            Registrati
          </Link>
        </p>
      </section>
    </main>
  )
}
