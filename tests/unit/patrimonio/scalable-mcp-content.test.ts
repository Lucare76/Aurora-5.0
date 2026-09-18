import { describe, expect, it } from 'vitest'

function parseJsonLikeText(value: string): unknown | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const candidates = [trimmed]
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) candidates.push(fenced[1].trim())
  const firstObject = trimmed.indexOf('{')
  const lastObject = trimmed.lastIndexOf('}')
  if (firstObject >= 0 && lastObject > firstObject) candidates.push(trimmed.slice(firstObject, lastObject + 1))
  const firstArray = trimmed.indexOf('[')
  const lastArray = trimmed.lastIndexOf(']')
  if (firstArray >= 0 && lastArray > firstArray) candidates.push(trimmed.slice(firstArray, lastArray + 1))
  for (const candidate of candidates) {
    try { return JSON.parse(candidate) } catch {}
  }
  return null
}

describe('Scalable MCP content normalization', () => {
  it('parses raw JSON text', () => {
    expect(parseJsonLikeText('{"holdings":[{"isin":"TEST"}]}')).toEqual({ holdings: [{ isin: 'TEST' }] })
  })

  it('parses fenced JSON returned as MCP text content', () => {
    expect(parseJsonLikeText('```json\n{"holdings":[{"isin":"TEST"}]}\n```')).toEqual({ holdings: [{ isin: 'TEST' }] })
  })

  it('parses JSON embedded in explanatory text', () => {
    expect(parseJsonLikeText('Result:\n{"holdings":[{"isin":"TEST"}]}\nDone')).toEqual({ holdings: [{ isin: 'TEST' }] })
  })
})
