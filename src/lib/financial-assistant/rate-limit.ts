import { DEFAULT_RATE_LIMIT_MAX_REQUESTS, DEFAULT_RATE_LIMIT_WINDOW_MS } from './constants'
import { FinancialAssistantError } from './errors'
import { hashIdentifier } from './redaction'

const buckets = new Map<string, { count: number; resetAt: number }>()

export function assertAssistantRateLimit(userId: string, now = Date.now()): void {
  const key = hashIdentifier(userId)
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + DEFAULT_RATE_LIMIT_WINDOW_MS })
    return
  }
  if (bucket.count >= DEFAULT_RATE_LIMIT_MAX_REQUESTS) {
    throw new FinancialAssistantError('RATE_LIMITED', 'Hai raggiunto il limite temporaneo di richieste. Riprova tra poco.', 429)
  }
  bucket.count += 1
}

export function resetAssistantRateLimit(): void {
  buckets.clear()
}

