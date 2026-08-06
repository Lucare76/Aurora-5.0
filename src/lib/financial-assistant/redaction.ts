import { createHash } from 'node:crypto'

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi
const SECRET_RE = /\b(?:eyJ|sbp_|sk_|pk_|Bearer\s+)[A-Za-z0-9._-]{16,}\b/g

export function hashIdentifier(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

export function redactText(value: unknown): string {
  return String(value ?? '')
    .replace(EMAIL_RE, '[email]')
    .replace(UUID_RE, '[id]')
    .replace(SECRET_RE, '[secret]')
    .slice(0, 500)
}

export function sanitizeAuditPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('balance')) return [key, '[amount]']
      if (typeof value === 'string') return [key, redactText(value)]
      return [key, value]
    }),
  )
}

