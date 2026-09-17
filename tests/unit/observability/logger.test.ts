import { describe, expect, it } from 'vitest'
import { sanitizeMetadata } from '@/lib/observability/logger'

describe('sanitizeMetadata', () => {
  it('redacts sensitive keys recursively', () => {
    expect(sanitizeMetadata({
      password: 'secret',
      nested: { authorization: 'Bearer token', safe: 'ok' },
      email: 'user@example.com',
    })).toEqual({
      password: '[redacted]',
      nested: { authorization: '[redacted]', safe: 'ok' },
      email: '[redacted]',
    })
  })

  it('limits long strings and arrays', () => {
    const result = sanitizeMetadata({
      message: 'x'.repeat(900),
      values: Array.from({ length: 30 }, (_, index) => index),
    })

    expect(result.message).toHaveLength(500)
    expect(result.values).toEqual(Array.from({ length: 20 }, (_, index) => index))
  })
})
