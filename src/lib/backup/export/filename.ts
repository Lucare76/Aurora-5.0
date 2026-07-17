export function createAuroraBackupFilename(date: Date): string {
  const year = date.getUTCFullYear()
  const month = pad(date.getUTCMonth() + 1)
  const day = pad(date.getUTCDate())
  const hours = pad(date.getUTCHours())
  const minutes = pad(date.getUTCMinutes())
  const seconds = pad(date.getUTCSeconds())

  return `aurora-backup-v1-${year}-${month}-${day}-${hours}${minutes}${seconds}.json`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
