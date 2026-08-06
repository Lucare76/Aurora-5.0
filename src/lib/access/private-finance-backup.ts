type BackupLike = {
  data?: {
    accountPurposeLinks?: Array<{ purpose?: string | null }>
    adiEntries?: unknown[]
    financeTransferMetadata?: Array<{ source_scope?: string | null; destination_scope?: string | null }>
    dependentBeneficiaries?: unknown[]
  }
}

function isPrivateScope(scope?: string | null): boolean {
  return scope === 'DEPENDENT_AURORA' || scope === 'DEPENDENT' || scope === 'ADI'
}

export function backupContainsPrivateFinance(backup: BackupLike): boolean {
  const data = backup.data
  if (!data) return false

  return Boolean(
    data.adiEntries?.length ||
    data.dependentBeneficiaries?.length ||
    data.accountPurposeLinks?.some((link) => isPrivateScope(link.purpose)) ||
    data.financeTransferMetadata?.some((row) => isPrivateScope(row.source_scope) || isPrivateScope(row.destination_scope)),
  )
}
