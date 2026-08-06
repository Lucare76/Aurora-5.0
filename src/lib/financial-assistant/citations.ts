import type { AssistantCitation } from './types'

export function makeCitation(params: Omit<AssistantCitation, 'id'>): AssistantCitation {
  const id = `c${Math.abs(hash(`${params.table}:${params.fields.join(',')}:${params.rowCount}:${params.filteredBy.join(',')}`))}`
  return { id, ...params }
}

function hash(input: string): number {
  let value = 0
  for (let index = 0; index < input.length; index += 1) {
    value = (value << 5) - value + input.charCodeAt(index)
    value |= 0
  }
  return value
}

