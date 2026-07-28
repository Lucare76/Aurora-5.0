/**
 * Encode a single CSV cell value.
 *
 * - Numbers (generated internally): formatted with 2 decimal places, no injection risk.
 * - Strings (potentially user-entered): protected from spreadsheet formula injection
 *   by prefixing with a tab character when the value starts with =, +, -, @, or |.
 */
export function csvCell(value: string | number | null): string {
  if (value === null) return '""'
  if (typeof value === 'number') {
    return `"${value.toFixed(2)}"`
  }
  const safe = /^[=+\-@|]/.test(value) ? `\t${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}
