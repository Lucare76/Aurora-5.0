export function parseItalianAmount(message: string): number | null {
  const normalized = message.toLowerCase().replace(/\s+/g, ' ')
  const thousandMatch = normalized.match(/(\d+(?:[,.]\d+)?)\s*(?:mila|k)\b/)
  if (thousandMatch) {
    const value = Number(thousandMatch[1].replace(',', '.')) * 1000
    return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null
  }

  const euroMatch = normalized.match(/(?:€\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?)(?:\s*€|\s*euro)?/)
    ?? normalized.match(/(?:€\s*)?(\d+(?:,\d{1,2})?)(?:\s*€|\s*euro)?/)
  if (!euroMatch) return null

  const raw = euroMatch[1]
  const value = Number(raw.replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 100) / 100
}
