type LogLevel = 'info' | 'warn' | 'error'

type Metadata = Record<string, unknown>

const SENSITIVE_KEY_PATTERN = /(password|secret|token|authorization|cookie|email|phone|iban|card|key)/i
const MAX_STRING_LENGTH = 500
const MAX_DEPTH = 4

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return '[max-depth]'
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH)
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message.slice(0, MAX_STRING_LENGTH),
      stack: process.env.NODE_ENV === 'development' ? value.stack?.slice(0, 2000) : undefined,
    }
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1))
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeValue(nested, depth + 1)
    }
    return output
  }
  return String(value).slice(0, MAX_STRING_LENGTH)
}

export function sanitizeMetadata(metadata: Metadata = {}): Metadata {
  return sanitizeValue(metadata, 0) as Metadata
}

function write(level: LogLevel, event: string, metadata: Metadata = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? 'local',
    ...sanitizeMetadata(metadata),
  }

  const line = JSON.stringify(payload)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
}

export const observability = {
  info(event: string, metadata?: Metadata) {
    write('info', event, metadata)
  },
  warn(event: string, metadata?: Metadata) {
    write('warn', event, metadata)
  },
  error(event: string, error?: unknown, metadata: Metadata = {}) {
    write('error', event, { ...metadata, error })
  },
}
