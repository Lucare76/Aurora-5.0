import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AiProvider, AiProviderConnectionStatus, AiProviderSetting, Database } from '@/types/database'

export const aiProviderSchema = z.enum(['OPENAI', 'ANTHROPIC', 'GEMINI'])

export const aiProviderSettingsInputSchema = z
  .object({
    provider: aiProviderSchema,
    enabled: z.boolean(),
    apiKey: z.string().trim().min(8).max(400).optional().or(z.literal('')),
  })
  .strict()

export type AiProviderSettingsInput = z.infer<typeof aiProviderSettingsInputSchema>

export type SafeAiProviderSettings = {
  provider: AiProvider
  enabled: boolean
  configured: boolean
  maskedApiKey: string | null
  connectionStatus: AiProviderConnectionStatus
  lastCheckedAt: string | null
  lastError: string | null
  updatedAt: string | null
}

export type ResolvedPersonalAiProvider = {
  provider: AiProvider
  apiKey: string
}

type SupabaseLike = SupabaseClient<Database> | {
  from: (table: string) => any
}

type AiProviderSettingsRow = AiProviderSetting

const ENCRYPTION_PREFIX = 'v1'
const KEY_ENV_NAMES = ['AI_PROVIDER_SETTINGS_SECRET', 'FINANCIAL_ASSISTANT_AI_KEY_ENCRYPTION_SECRET']

export function getEncryptionSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  for (const name of KEY_ENV_NAMES) {
    const value = env[name]
    if (value && value.trim().length >= 32) return value
  }
  return null
}

export function maskApiKey(last4: string | null | undefined): string | null {
  if (!last4) return null
  return `************${last4}`
}

export function validateApiKeyFormat(provider: AiProvider, apiKey: string): boolean {
  const value = apiKey.trim()
  if (provider === 'OPENAI') return /^sk-(?!ant-)[A-Za-z0-9_-]{16,}$/.test(value)
  if (provider === 'ANTHROPIC') return /^sk-ant-[A-Za-z0-9_-]{16,}$/.test(value)
  if (provider === 'GEMINI') return /^[A-Za-z0-9_-]{20,}$/.test(value)
  return false
}

export function encryptApiKey(apiKey: string, secret: string): string {
  const iv = randomBytes(12)
  const key = createHash('sha256').update(secret).digest()
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [ENCRYPTION_PREFIX, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(':')
}

export function decryptApiKey(payload: string, secret: string): string {
  const [version, ivText, tagText, ciphertextText] = payload.split(':')
  if (version !== ENCRYPTION_PREFIX || !ivText || !tagText || !ciphertextText) {
    throw new Error('Formato chiave cifrata non valido.')
  }
  const key = createHash('sha256').update(secret).digest()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export function apiKeyMatchesLast4(apiKey: string, last4: string | null | undefined): boolean {
  if (!last4 || apiKey.length < 4) return false
  const left = Buffer.from(apiKey.slice(-4))
  const right = Buffer.from(last4)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function toSafeAiProviderSettings(row: Partial<AiProviderSettingsRow> | null): SafeAiProviderSettings {
  return {
    provider: row?.provider ?? 'OPENAI',
    enabled: Boolean(row?.enabled),
    configured: Boolean(row?.encrypted_api_key && row?.api_key_last4),
    maskedApiKey: maskApiKey(row?.api_key_last4),
    connectionStatus: row?.connection_status ?? 'not_configured',
    lastCheckedAt: row?.last_checked_at ?? null,
    lastError: row?.last_error ?? null,
    updatedAt: row?.updated_at ?? null,
  }
}

export async function getSafeAiProviderSettings(
  supabase: SupabaseLike,
  userId: string,
): Promise<SafeAiProviderSettings> {
  const { data, error } = await supabase
    .from('ai_provider_settings')
    .select('provider,encrypted_api_key,api_key_last4,enabled,connection_status,last_checked_at,last_error,updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error('Impostazioni AI non disponibili.')
  return toSafeAiProviderSettings(data as Partial<AiProviderSettingsRow> | null)
}

export async function upsertAiProviderSettings(params: {
  supabase: SupabaseLike
  userId: string
  input: AiProviderSettingsInput
}): Promise<SafeAiProviderSettings> {
  const parsed = aiProviderSettingsInputSchema.parse(params.input)
  const current = await getRawAiProviderSettings(params.supabase, params.userId)
  const trimmedKey = parsed.apiKey?.trim()
  const secret = getEncryptionSecret()

  if (parsed.enabled && !trimmedKey && !current?.encrypted_api_key) {
    throw new Error('Inserisci una API key prima di abilitare la modalità intelligente.')
  }
  if (trimmedKey && !validateApiKeyFormat(parsed.provider, trimmedKey)) {
    throw new Error('Formato API key non valido per il provider selezionato.')
  }
  if (trimmedKey && !secret) {
    throw new Error('Cifratura API key non configurata sul server.')
  }

  const encrypted = trimmedKey && secret ? encryptApiKey(trimmedKey, secret) : current?.encrypted_api_key ?? null
  const last4 = trimmedKey ? trimmedKey.slice(-4) : current?.api_key_last4 ?? null
  const connectionStatus: AiProviderConnectionStatus = encrypted ? 'configured' : 'not_configured'

  const { data, error } = await params.supabase
    .from('ai_provider_settings')
    .upsert({
      user_id: params.userId,
      provider: parsed.provider,
      enabled: parsed.enabled,
      encrypted_api_key: encrypted,
      api_key_last4: last4,
      connection_status: connectionStatus,
      last_error: null,
    }, { onConflict: 'user_id' })
    .select('provider,encrypted_api_key,api_key_last4,enabled,connection_status,last_checked_at,last_error,updated_at')
    .single()

  if (error) throw new Error('Impostazioni AI non salvate.')
  return toSafeAiProviderSettings(data as Partial<AiProviderSettingsRow>)
}

export async function resolvePersonalAiProvider(
  supabase: SupabaseLike,
  userId: string,
): Promise<ResolvedPersonalAiProvider | null> {
  const row = await getRawAiProviderSettings(supabase, userId)
  if (!row?.enabled || !row.encrypted_api_key) return null
  const secret = getEncryptionSecret()
  if (!secret) return null
  try {
    return {
      provider: row.provider,
      apiKey: decryptApiKey(row.encrypted_api_key, secret),
    }
  } catch {
    return null
  }
}

export async function markAiProviderConnectionResult(params: {
  supabase: SupabaseLike
  userId: string
  ok: boolean
  error?: string | null
}): Promise<void> {
  await params.supabase
    .from('ai_provider_settings')
    .update({
      connection_status: params.ok ? 'verified' : 'error',
      last_checked_at: new Date().toISOString(),
      last_error: params.ok ? null : params.error ?? 'Verifica connessione non riuscita.',
    })
    .eq('user_id', params.userId)
}

async function getRawAiProviderSettings(
  supabase: SupabaseLike,
  userId: string,
): Promise<AiProviderSettingsRow | null> {
  const { data, error } = await supabase
    .from('ai_provider_settings')
    .select('id,user_id,provider,encrypted_api_key,api_key_last4,enabled,connection_status,last_checked_at,last_error,created_at,updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error('Impostazioni AI non disponibili.')
  return data as AiProviderSettingsRow | null
}
