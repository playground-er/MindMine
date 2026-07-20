import { useQuery } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

import { getSupabase } from '../lib/supabase'
import type { Member } from '../types/db'

export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const sb = getSupabase()
    let active = true

    void sb.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setIsLoading(false)
    })

    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setIsLoading(false)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return { session, isLoading }
}

/**
 * Being in `auth.users` is not the same as being a member.
 *
 * RLS makes this read do double duty: a non-member fails `is_member()`, so the
 * select comes back empty rather than erroring. No rows means "authenticated
 * but not registered" — the case the login screen has to explain.
 */
export function useMember(userId: string | undefined) {
  return useQuery({
    queryKey: ['member', userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Member | null> => {
      const { data, error } = await getSupabase()
        .from('member')
        .select('*')
        .eq('id', userId!)
        .maybeSingle()

      if (error) throw error
      return (data as Member | null) ?? null
    },
  })
}

export async function sendMagicLink(email: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut()
}
