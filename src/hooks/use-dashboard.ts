'use client'

import { useEffect, useState } from 'react'
import type { DashboardPayload } from '@/lib/dashboard/service'

export function useDashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    fetch('/api/dashboard', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        return res.json() as Promise<DashboardPayload>
      })
      .then((payload) => {
        if (mounted) { setData(payload); setLoading(false) }
      })
      .catch((err: unknown) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'error')
          setLoading(false)
        }
      })
    return () => { mounted = false }
  }, [])

  return { data, loading, error }
}
