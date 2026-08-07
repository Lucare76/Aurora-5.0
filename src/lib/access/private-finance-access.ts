import type { User } from '@supabase/supabase-js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(email?: string | null): string {
  return email?.trim().toLowerCase() ?? ''
}

export function isPrivateFinanceConfigured(): boolean {
  const configuredEmail = normalizeEmail(process.env.PRIVATE_FINANCE_ACCOUNT_EMAIL)
  return EMAIL_PATTERN.test(configuredEmail)
}

export function canAccessPrivateFinance(email?: string | null): boolean {
  const configuredEmail = normalizeEmail(process.env.PRIVATE_FINANCE_ACCOUNT_EMAIL)
  if (!EMAIL_PATTERN.test(configuredEmail)) return false

  return normalizeEmail(email) === configuredEmail
}

export function requirePrivateFinanceAccess(user?: Pick<User, 'email'> | null): boolean {
  return canAccessPrivateFinance(user?.email)
}

export function canAccessPrivateHr(email?: string | null): boolean {
  const configuredEmail = normalizeEmail(process.env.PRIVATE_HR_ACCOUNT_EMAIL ?? process.env.PRIVATE_FINANCE_ACCOUNT_EMAIL)
  if (!EMAIL_PATTERN.test(configuredEmail)) return false

  return normalizeEmail(email) === configuredEmail
}

export function requirePrivateHrAccess(user?: Pick<User, 'email'> | null): boolean {
  return canAccessPrivateHr(user?.email)
}
