import * as XLSX from 'xlsx'

export type PosteAccount = {
  id: string
  name: string
  balance: number
}

export type PosteImportedAsset = {
  externalKey: string
  name: string
  accountName: string
  investedAmount: number
  currentValue: number
  instrument: string
  notes: string
}

export const POSTE_MANUAL_PRODUCTS = [
  {
    key: 'poste-progetti-futuri',
    name: 'Poste Progetti Futuri',
    accountName: 'Polizze Vita',
    assetType: 'investment' as const,
  },
  {
    key: 'postaprevidenza-valore',
    name: 'Postaprevidenza Valore',
    accountName: 'Postaprevidenza Valore Fondo',
    assetType: 'pension' as const,
  },
  {
    key: 'buono-ordinario-primo',
    name: 'Buono Ordinario Primo',
    accountName: 'Buono Ordinario Primo',
    assetType: 'investment' as const,
  },
  {
    key: 'buono-ordinario-secondo',
    name: 'Buono Ordinario Secondo',
    accountName: 'Buono Ordinario Secondo',
    assetType: 'investment' as const,
  },
] as const

const BUONO_ACCOUNT_NAMES: Record<string, string> = {
  'BUONO ORDINARIO': 'Buono Ordinario',
  'BUONO 3X4': 'Buono 3x4',
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

export function parseEuro(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const raw = normalizeText(value)
  if (!raw) return null

  const normalized = raw
    .replace(/€/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizePosteProductName(value: unknown) {
  return normalizeText(value).toLocaleUpperCase('it-IT')
}

export function parsePosteBuoniWorkbook(buffer: ArrayBuffer): PosteImportedAsset[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) throw new Error('POSTE_WORKBOOK_EMPTY')

  const sheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false,
  })

  const parsed: PosteImportedAsset[] = []

  for (const row of rows) {
    const product = normalizePosteProductName(row.TIPOLOGIA)
    const accountName = BUONO_ACCOUNT_NAMES[product]
    if (!accountName) continue

    const currentValue = parseEuro(row['VALORE RIMBORSO NETTO'])
    const nominalValue = parseEuro(row['VALORE NOMINALE'])
    if (currentValue == null || nominalValue == null) continue

    const series = normalizeText(row.SERIE)
    const subscribedAt = normalizeText(row['DATA SOTTOSCRIZIONE'])
    const expiry = normalizeText(row.SCADENZA)
    const gross = parseEuro(row['VALORE DI RIMBORSO LORDO'])

    const keyParts = [product, series || 'NO_SERIE', subscribedAt || 'NO_DATA']
    const notes = [
      'Importato da file Poste Italiane.',
      gross != null ? `Valore di rimborso lordo: € ${gross.toFixed(2)}.` : null,
      expiry ? `Scadenza: ${expiry}.` : null,
      series ? `Serie: ${series}.` : null,
      'Valore patrimoniale usato: valore di rimborso netto.',
    ].filter(Boolean).join(' ')

    parsed.push({
      externalKey: keyParts.join('|'),
      name: accountName,
      accountName,
      investedAmount: nominalValue,
      currentValue,
      instrument: product,
      notes,
    })
  }

  if (parsed.length === 0) throw new Error('POSTE_NO_SUPPORTED_ROWS')
  return parsed
}

export function resolvePosteAccount(accountName: string, accounts: PosteAccount[]) {
  const target = accountName.trim().toLocaleLowerCase('it-IT')
  return accounts.find((account) => account.name.trim().toLocaleLowerCase('it-IT') === target) ?? null
}

export function manualPosteProduct(productKey: string) {
  return POSTE_MANUAL_PRODUCTS.find((product) => product.key === productKey) ?? null
}
