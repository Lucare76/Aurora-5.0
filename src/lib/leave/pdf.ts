import type { LeaveEntry, LeaveSettings } from '@/types/database'
import {
  annualVacationRemaining,
  annualVacationUsed,
  monthlyPermitRemaining,
  monthlyPermitUsed,
} from './calculations'

export function buildLeavePdf(params: {
  kind: 'vacation' | 'permits' | 'summary'
  year: number
  month?: number
  settings: LeaveSettings
  entries: LeaveEntry[]
}): Uint8Array {
  const lines = buildLines(params).map(escapePdfText)
  const content = [
    'BT',
    '/F1 16 Tf',
    '50 790 Td',
    ...lines.flatMap((line, index) => [
      index === 0 ? `(${line}) Tj` : `0 -18 Td (${line}) Tj`,
      ...(index === 0 ? ['/F1 10 Tf'] : []),
    ]),
    'ET',
  ].join('\n')
  return makePdf(content)
}

function buildLines(params: {
  kind: 'vacation' | 'permits' | 'summary'
  year: number
  month?: number
  settings: LeaveSettings
  entries: LeaveEntry[]
}): string[] {
  const vacationUsed = annualVacationUsed(params.entries, params.year)
  const vacationRemaining = annualVacationRemaining(params.settings, params.entries, params.year)
  const month = params.month ?? new Date().getMonth() + 1
  const permitUsed = monthlyPermitUsed(params.entries, params.year, month)
  const permitRemaining = monthlyPermitRemaining(params.settings, params.entries, params.year, month)
  const vacationEntries = params.entries.filter((entry) => entry.type === 'VACATION' && entry.start_date.startsWith(String(params.year)))
  const permitEntries = params.entries.filter((entry) => entry.type === 'PERMIT_104' && entry.start_date.startsWith(`${params.year}-${String(month).padStart(2, '0')}`))

  const common = ['Documento generato da Aurora', '']
  if (params.kind === 'vacation') {
    return [
      'Ferie annuali',
      `Anno: ${params.year}`,
      `Disponibili: ${params.settings.vacation_days_per_year} giorni`,
      `Utilizzati: ${vacationUsed} giorni`,
      `Residui: ${vacationRemaining} giorni`,
      '',
      'Dettaglio periodi:',
      ...vacationEntries.map((entry) => `${entry.start_date} - ${entry.end_date}: ${entry.days ?? 0} giorni ${entry.note ?? ''}`),
      ...common,
    ]
  }
  if (params.kind === 'permits') {
    return [
      'Permessi 104 mensili',
      `Periodo: ${String(month).padStart(2, '0')}/${params.year}`,
      `Disponibili: ${params.settings.permit_104_hours_per_month} ore`,
      `Utilizzati: ${permitUsed} ore`,
      `Residui: ${permitRemaining} ore`,
      '',
      'Dettaglio ore:',
      ...permitEntries.map((entry) => `${entry.start_date}: ${entry.hours ?? 0} ore ${entry.start_time ?? ''}-${entry.end_time ?? ''} ${entry.note ?? ''}`),
      ...common,
    ]
  }
  return [
    'Riepilogo annuale ferie e permessi',
    `Anno: ${params.year}`,
    `Ferie usate: ${vacationUsed} giorni`,
    `Ferie residue: ${vacationRemaining} giorni`,
    `Permessi usati nel mese ${month}: ${permitUsed} ore`,
    `Permessi residui nel mese ${month}: ${permitRemaining} ore`,
    `Periodi ferie: ${vacationEntries.length}`,
    `Permessi mese: ${permitEntries.length}`,
    ...common,
  ]
}

function makePdf(content: string): Uint8Array {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i < offsets.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Uint8Array(Buffer.from(pdf, 'binary'))
}

function escapePdfText(value: string): string {
  return value.replace(/[()\\]/g, '\\$&').replace(/[^\x20-\x7E]/g, '?')
}
