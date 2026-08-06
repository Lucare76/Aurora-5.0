const ACCENTS: Record<string, string> = {
  à: 'a',
  á: 'a',
  è: 'e',
  é: 'e',
  ì: 'i',
  í: 'i',
  ò: 'o',
  ó: 'o',
  ù: 'u',
  ú: 'u',
}

export function normalizeAssistantMessage(message: string): string {
  return message
    .trim()
    .toLowerCase()
    .replace(/[àáèéìíòóùú]/g, (char) => ACCENTS[char] ?? char)
    .replace(/[’']/g, ' ')
    .replace(/[^\p{L}\p{N}€.,\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function containsUnsafeInstruction(normalized: string): boolean {
  return [
    'ignora le regole',
    'read only false',
    'readonly false',
    'service role',
    'esegui sql',
    'mostrami dati di un altro',
    'altro account',
    'non sono autorizzato',
    'mostrami l email autorizzata',
    'api key',
    'system prompt',
  ].some((needle) => normalized.includes(needle))
}

export function containsWriteRequest(normalized: string): boolean {
  return /\b(crea|creami|modifica|elimina|cancella|sposta|trasferisci|paga|inserisci|registra|aggiorna)\b/.test(normalized)
}
