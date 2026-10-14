const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const ITALIAN_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

function validParts(year: number, month: number, day: number): boolean {
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= days[month - 1]
}

/** Accepts Italian entry or an ISO paste; returns the unchanged storage convention. */
export function parseItalianDate(value: string): string | null {
  const text = value.trim()
  const iso = ISO_DATE.exec(text)
  const italian = ITALIAN_DATE.exec(text)
  if (!iso && !italian) return null
  const year = Number(iso ? iso[1] : italian![3])
  const month = Number(iso ? iso[2] : italian![2])
  const day = Number(iso ? iso[3] : italian![1])
  if (!validParts(year, month, day)) return null
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function formatItalianDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  if (typeof value === 'string' && ISO_DATE.test(value)) {
    const iso = parseItalianDate(value)
    return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—'
  }
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Rome',
  }).format(date)
}

export function formatItalianDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  const time = new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Rome',
  }).format(date)
  return `${formatItalianDate(date)} ${time}`
}

export function dateInputError(text: string, min?: string, max?: string): string {
  if (!text.trim()) return ''
  const iso = parseItalianDate(text)
  if (!iso) return 'Inserisci una data valida nel formato gg/mm/aaaa.'
  if (min && iso < min) return `La data deve essere dal ${formatItalianDate(min)}.`
  if (max && iso > max) return `La data deve essere entro il ${formatItalianDate(max)}.`
  return ''
}

export function normalizeDateDraft(text: string): string {
  if (!/^\d{1,8}$/.test(text)) return text
  return [text.slice(0, 2), text.slice(2, 4), text.slice(4)].filter(Boolean).join('/')
}
