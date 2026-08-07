import type { AiComposedResponse } from './types'

function numbersIn(value: string): string[] {
  return value.match(/\b\d+(?:[.,]\d+)?\b/g) ?? []
}

export function validateComposedResponseAgainstFacts(response: AiComposedResponse, allowedFacts: string[]): AiComposedResponse {
  const factText = allowedFacts.join(' ')
  const text = [response.answer, ...response.summary].join(' ')
  const unsupportedNumbers = numbersIn(text).filter((value) => !factText.includes(value))
  if (unsupportedNumbers.length > 0) {
    throw new Error('La risposta AI contiene numeri non presenti nelle evidenze deterministiche.')
  }
  return response
}
