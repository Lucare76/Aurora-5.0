import { describe, expect, it, vi } from 'vitest'
import { testAiProviderConnection } from '@/lib/financial-assistant/providers/connection-test'

describe('personal AI provider connection test', () => {
  it('rifiuta provider con formato chiave non valido senza chiamare rete', async () => {
    const fetchImpl = vi.fn()
    const result = await testAiProviderConnection({ provider: 'OPENAI', apiKey: 'bad', fetchImpl: fetchImpl as unknown as typeof fetch })

    expect(result.ok).toBe(false)
    expect(result.status).toBe('invalid_format')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('verifica OpenAI senza inviare prompt finanziari', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 })

    const result = await testAiProviderConnection({
      provider: 'OPENAI',
      apiKey: 'sk-proj_1234567890abcdef',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result.ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('https://api.openai.com/v1/models/'), expect.objectContaining({
      method: 'GET',
    }))
    expect(JSON.stringify(fetchImpl.mock.calls[0])).not.toMatch(/saldo|conto|transazione|patrimonio/i)
  })

  it('mappa errore autenticazione provider', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 401 })
    const result = await testAiProviderConnection({
      provider: 'ANTHROPIC',
      apiKey: 'sk-ant-api03-1234567890abcdef',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result.ok).toBe(false)
    expect(result.status).toBe('auth_error')
  })

  it('supporta Gemini con header API key e ping neutro', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    await testAiProviderConnection({
      provider: 'GEMINI',
      apiKey: 'AIzaSyA1234567890abcdefghi',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const [, init] = fetchImpl.mock.calls[0]
    expect(init.headers['x-goog-api-key']).toBe('AIzaSyA1234567890abcdefghi')
    expect(init.body).toContain('ping')
    expect(init.body).not.toMatch(/saldo|conto|transazione|patrimonio/i)
  })
})
