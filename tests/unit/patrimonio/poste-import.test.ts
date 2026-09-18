import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseEuro, parsePosteBuoniWorkbook } from '@/lib/integrations/poste'

describe('Poste patrimonio import', () => {
  it('parses Italian euro amounts', () => {
    expect(parseEuro('€38.896,85')).toBe(38896.85)
    expect(parseEuro('5.269,15 €')).toBe(5269.15)
    expect(parseEuro('')).toBeNull()
  })

  it('maps supported Poste buoni to Aurora accounts and uses net redemption value', () => {
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.json_to_sheet([
      {
        TIPOLOGIA: 'BUONO ORDINARIO',
        'VALORE RIMBORSO NETTO': '€38.896,85',
        'VALORE NOMINALE': '€38.000,00',
        'VALORE DI RIMBORSO LORDO': '39.024,97 €',
        'DATA SOTTOSCRIZIONE': '20/05/2019',
        SCADENZA: '20.05.2039',
        SERIE: 'TF120A190322',
      },
      {
        TIPOLOGIA: 'BUONO 3X4',
        'VALORE RIMBORSO NETTO': '€5.269,15',
        'VALORE NOMINALE': '€5.000,00',
        'DATA SOTTOSCRIZIONE': '20/05/2019',
        SCADENZA: '20.05.2031',
        SERIE: 'TF212A190322',
      },
    ])
    XLSX.utils.book_append_sheet(workbook, sheet, 'RPOL_PatrimonioBuoni')
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer

    const assets = parsePosteBuoniWorkbook(bytes)
    expect(assets).toHaveLength(2)
    expect(assets[0]).toMatchObject({
      name: 'Buono Ordinario',
      accountName: 'Buono Ordinario',
      investedAmount: 38000,
      currentValue: 38896.85,
    })
    expect(assets[1]).toMatchObject({
      name: 'Buono 3x4',
      accountName: 'Buono 3x4',
      investedAmount: 5000,
      currentValue: 5269.15,
    })
  })
})
