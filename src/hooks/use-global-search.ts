'use client'

import { useEffect, useRef, useState } from 'react'
import type { SearchPayload } from '@/lib/search/types'

const DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2

export function useGlobalSearch(open: boolean, query: string) {
  const [data, setData] = useState<SearchPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    if (!open) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    const trimmed = query.trim().replace(/\s+/g, ' ')
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    const id = requestId.current + 1
    requestId.current = id
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) {
          if (res.status === 401) throw new Error('SESSION_EXPIRED')
          throw new Error('SEARCH_FAILED')
        }
        const payload = await res.json() as SearchPayload
        if (requestId.current === id) setData(payload)
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return
        if (requestId.current === id) setError(err instanceof Error ? err.message : 'SEARCH_FAILED')
      } finally {
        if (requestId.current === id) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [open, query])

  return { data, loading, error, debounceMs: DEBOUNCE_MS, minQueryLength: MIN_QUERY_LENGTH }
}
