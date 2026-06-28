'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function toItalianAuthError(error: Error): Error {
  const message = error.message.toLowerCase()

  if (message.includes('invalid login credentials')) {
    return new Error('Email o password non corretti.')
  }
  if (message.includes('email not confirmed')) {
    return new Error('Conferma la tua email prima di accedere.')
  }
  if (message.includes('user already registered') || message.includes('already registered')) {
    return new Error('Esiste già un account con questa email.')
  }
  if (message.includes('password')) {
    return new Error('La password non rispetta i requisiti richiesti.')
  }

  return new Error(error.message || 'Operazione non riuscita. Riprova tra poco.')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const fetchProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      setProfile(data ?? null)
      return data ?? null
    },
    [supabase],
  )

  useEffect(() => {
    let mounted = true

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (!session?.user) {
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      setUser(session.user)
      try {
        await fetchProfile(session.user.id)
      } catch {
        // profile fetch failed, user still authenticated
      }
      if (mounted) setLoading(false)
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return

      const nextUser = session?.user ?? null
      setUser(nextUser)

      if (!nextUser) {
        setProfile(null)
        setLoading(false)
        return
      }

      try {
        await fetchProfile(nextUser.id)
      } catch {
        // profile fetch failed
      }
      if (mounted) setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw toItalianAuthError(error)
    },
    [supabase],
  )

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: displayName.trim() },
        },
      })
      if (error) throw toItalianAuthError(error)

      if (data.user) {
        const { error: rpcError } = await supabase.rpc(
          'create_default_categories' as never,
          { p_user_id: data.user.id } as never,
        )
        if (rpcError) {
          throw new Error('Account creato, ma non è stato possibile creare le categorie iniziali.')
        }
      }
    },
    [supabase],
  )

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw toItalianAuthError(error)
    setUser(null)
    setProfile(null)
  }, [supabase])

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
