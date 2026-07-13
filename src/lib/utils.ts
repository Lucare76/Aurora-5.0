import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format as fnsFormat, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(
  amount: number,
  currency = 'EUR',
  locale = 'it-IT'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount)
}

export function formatDate(date: string | Date, formatStr = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return fnsFormat(d, formatStr, { locale: it })
}

export function getMonthName(month: number, locale = 'it-IT'): string {
  const date = new Date(2024, month - 1, 1)
  return date.toLocaleDateString(locale, { month: 'long' })
}
