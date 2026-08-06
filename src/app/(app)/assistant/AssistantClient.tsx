'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { AssistantComposer } from './AssistantComposer'
import { AssistantEmptyState } from './AssistantEmptyState'
import { AssistantErrorState } from './AssistantErrorState'
import { AssistantHeader } from './AssistantHeader'
import { AssistantMessage, type AssistantChatMessage } from './AssistantMessage'
import { AssistantScopeSelector } from './AssistantScopeSelector'
import { buildAssistantChatPayload, visibleAssistantScopes, visibleAssistantSuggestions, type AssistantCapabilitiesResponse } from './chat-ui'
import type { AssistantResult, FinancialAssistantScope } from '@/lib/financial-assistant/types'

type ChatResponse = {
  result: AssistantResult
}

function messageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function AssistantClient() {
  const [capabilities, setCapabilities] = useState<AssistantCapabilitiesResponse | null>(null)
  const [capabilityError, setCapabilityError] = useState<string | null>(null)
  const [scope, setScope] = useState<FinancialAssistantScope>('PERSONAL')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<AssistantChatMessage[]>([
    {
      id: 'notice',
      type: 'SYSTEM_NOTICE',
      content: 'Questa conversazione non viene ancora salvata. Nessun dato viene inviato a un modello esterno.',
    },
  ])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const liveRef = useRef<HTMLDivElement | null>(null)

  const loadCapabilities = useCallback(async () => {
    setCapabilityError(null)
    try {
      const response = await fetch('/api/financial-assistant/capabilities', { cache: 'no-store' })
      if (!response.ok) throw new Error(response.status === 403 ? 'Assistente non abilitato.' : 'Impossibile caricare le capability.')
      const data = (await response.json()) as AssistantCapabilitiesResponse
      setCapabilities(data)
      const scopes = visibleAssistantScopes(data)
      setScope(scopes.includes('PERSONAL') ? 'PERSONAL' : scopes[0] ?? 'PERSONAL')
    } catch (error) {
      setCapabilityError(error instanceof Error ? error.message : 'Errore durante il caricamento.')
      setCapabilities(null)
    }
  }, [])

  useEffect(() => {
    loadCapabilities()
  }, [loadCapabilities])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const query = new URLSearchParams(window.location.search).get('q')
    if (query) setInput(query)
  }, [])

  useEffect(() => {
    liveRef.current?.focus()
  }, [messages.length])

  const scopes = useMemo(() => visibleAssistantScopes(capabilities), [capabilities])
  const suggestions = useMemo(() => visibleAssistantSuggestions(capabilities), [capabilities])

  const sendMessage = useCallback(async (text?: string) => {
    const message = (text ?? input).trim()
    if (!message || loading) return
    setLoading(true)
    setInput('')
    const controller = new AbortController()
    abortRef.current = controller
    setMessages((current) => [...current, { id: messageId('user'), type: 'USER', content: message }])

    try {
      const response = await fetch('/api/financial-assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAssistantChatPayload(message, scope)),
        signal: controller.signal,
      })
      const data = await response.json().catch(() => null) as ChatResponse | { error?: string } | null
      if (!response.ok || !data || !('result' in data)) {
        const errorMessage = data && 'error' in data && data.error ? data.error : 'Analisi non riuscita. Riprova.'
        throw new Error(errorMessage)
      }
      setMessages((current) => [
        ...current,
        {
          id: messageId(data.result.status === 'NEEDS_INPUT' ? 'question' : 'assistant'),
          type: data.result.status === 'NEEDS_INPUT' ? 'ASSISTANT_QUESTION' : 'ASSISTANT_RESULT',
          content: data.result.answer,
          result: data.result,
        },
      ])
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setMessages((current) => [...current, { id: messageId('cancel'), type: 'SYSTEM_NOTICE', content: 'Analisi annullata.' }])
      } else {
        setMessages((current) => [...current, { id: messageId('error'), type: 'ASSISTANT_ERROR', content: error instanceof Error ? error.message : 'Errore interno.' }])
      }
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [input, loading, scope])

  const cancel = () => {
    abortRef.current?.abort()
  }

  const changeScope = (nextScope: FinancialAssistantScope) => {
    setScope(nextScope)
    setInput('')
    setMessages((current) => [
      ...current,
      { id: messageId('scope'), type: 'SYSTEM_NOTICE', content: `Perimetro aggiornato: ${nextScope}. Eventuali bozze incompatibili sono state azzerate.` },
    ])
  }

  if (capabilityError) {
    return (
      <div className="space-y-6">
        <AssistantHeader />
        <AssistantErrorState message={capabilityError} onRetry={loadCapabilities} />
      </div>
    )
  }

  if (!capabilities) {
    return (
      <div className="space-y-6" aria-live="polite">
        <AssistantHeader />
        <div className="flex items-center gap-3 rounded-3xl border border-[#e5e7f0] bg-white p-5 text-sm font-semibold text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          Caricamento assistente...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AssistantHeader />
      <div className="flex flex-col gap-3 rounded-3xl border border-[#e5e7f0] bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <AssistantScopeSelector scopes={scopes} value={scope} onChange={changeScope} />
        <div className="text-xs leading-5 text-slate-500">
          <p>Aurora non modifica i tuoi dati.</p>
          <p>Le risposte sono basate sui dati del gestionale.</p>
        </div>
      </div>

      <div ref={liveRef} tabIndex={-1} aria-live="polite" className="space-y-4 outline-none">
        {messages.length <= 1 ? <AssistantEmptyState suggestions={suggestions} onPick={sendMessage} /> : messages.map((message) => <AssistantMessage key={message.id} message={message} />)}
        {loading && (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-[#e5e7f0] bg-white px-4 py-3 text-sm font-semibold text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
            Analisi in corso...
          </div>
        )}
      </div>

      <AssistantComposer value={input} disabled={!capabilities.enabled} loading={loading} onChange={setInput} onSubmit={() => sendMessage()} onCancel={cancel} />
    </div>
  )
}
