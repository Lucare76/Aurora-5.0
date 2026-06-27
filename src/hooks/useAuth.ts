import { useCallback, useEffect, useState } from 'react'
import type { AuthError, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'

interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
}

function toItalianAuthError(error: AuthError | Error): Error {
  const message = error.message.toLowerCase()

  if (message.includes('invalid login credentials')) {
    return new Error('Email o password non corretti.')
  }

  if (message.includes('email not confirmed')) {
    return new Error('Conferma la tua email prima di accedere.')
  }

  if (message.includes('user already registered') || message.includes('already registered')) {
    return new Error('Esiste gia un account con questa email.')
  }

  if (message.includes('password')) {
    return new Error('La password non rispetta i requisiti richiesti.')
  }

  return new Error(error.message || 'Operazione non riuscita. Riprova tra poco.')
}

export function useAuth() {
  const [{ user, profile, loading }, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
  })

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      throw error
    }

    setState((current) => ({ ...current, profile: data ?? null }))
    return data ?? null
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession()

      if (!mounted) return

      if (error || !data.session?.user) {
        setState({ user: null, profile: null, loading: false })
        return
      }

      setState({ user: data.session.user, profile: null, loading: true })

      try {
        const loadedProfile = await fetchProfile(data.session.user.id)
        if (mounted) {
          setState({ user: data.session.user, profile: loadedProfile, loading: false })
        }
      } catch {
        if (mounted) {
          setState({ user: data.session.user, profile: null, loading: false })
        }
      }
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return

      const nextUser = session?.user ?? null

      if (!nextUser) {
        setState({ user: null, profile: null, loading: false })
        return
      }

      setState({ user: nextUser, profile: null, loading: true })

      try {
        const loadedProfile = await fetchProfile(nextUser.id)
        if (mounted) {
          setState({ user: nextUser, profile: loadedProfile, loading: false })
        }
      } catch {
        if (mounted) {
          setState({ user: nextUser, profile: null, loading: false })
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      throw toItalianAuthError(error)
    }

    if (data.user) {
      await fetchProfile(data.user.id)
    }

    return data
  }, [fetchProfile])

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: displayName.trim(),
        },
      },
    })

    if (error) {
      throw toItalianAuthError(error)
    }

    if (data.user) {
      const { error: rpcError } = await ((supabase.rpc as unknown) as (
        fn: 'create_default_categories',
        args: { p_user_id: string }
      ) => Promise<{ error: Error | null }>)('create_default_categories', {
        p_user_id: data.user.id,
      })

      if (rpcError) {
        throw new Error('Account creato, ma non e stato possibile creare le categorie iniziali.')
      }

      await fetchProfile(data.user.id)
    }

    return data
  }, [fetchProfile])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      throw toItalianAuthError(error)
    }

    setState({ user: null, profile: null, loading: false })
  }, [])

  return {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
  }
}
