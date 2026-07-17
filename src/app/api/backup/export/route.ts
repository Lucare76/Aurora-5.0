import { NextResponse } from 'next/server'

import { createAuroraBackupFilename, fetchUserBackupData, generateAuroraBackup, getAuthenticatedBackupUser } from '@/lib/backup/export'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const user = await getAuthenticatedBackupUser(supabase)

    if (!user) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const backupData = await fetchUserBackupData(supabase, user)
    const generated = generateAuroraBackup(backupData)
    const filename = createAuroraBackupFilename(new Date(generated.backup.createdAt))

    return new NextResponse(generated.json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      console.error('[aurora-backup-export]', error.name, error.message)
    }

    return NextResponse.json(
      { error: 'Non è stato possibile creare un backup verificato. Nessun dato è stato modificato.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
