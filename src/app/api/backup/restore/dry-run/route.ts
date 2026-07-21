import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  fetchCurrentUserDataSnapshot,
  getAuthenticatedRestoreUser,
  inspectAuroraBackup,
  runRestoreDryRun,
  summarizeDryRunForLog,
} from '@/lib/backup'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const MAX_BACKUP_DRY_RUN_BYTES = 10 * 1024 * 1024

const requestSchema = z.object({
  filename: z.string().min(1).max(255),
  content: z.string().min(1),
}).strict()

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await getAuthenticatedRestoreUser(supabase)

    if (!user) {
      return json({ error: 'Non autenticato' }, 401)
    }

    const rawBody = await request.text()
    if (byteLength(rawBody) > MAX_BACKUP_DRY_RUN_BYTES) {
      return json({ error: 'File troppo grande. Il limite massimo è 10 MB.' }, 413)
    }

    const parsedBody = parseJson(rawBody)
    if (!parsedBody.ok) {
      return json({ error: 'JSON non valido' }, 400)
    }

    const parsedRequest = requestSchema.safeParse(parsedBody.value)
    if (!parsedRequest.success) {
      return json({ error: 'Richiesta non valida' }, 400)
    }

    const { filename, content } = parsedRequest.data
    if (!filename.toLowerCase().endsWith('.json')) {
      return json({ error: 'Sono accettati solo file .json' }, 415)
    }
    if (byteLength(content) > MAX_BACKUP_DRY_RUN_BYTES) {
      return json({ error: 'File troppo grande. Il limite massimo è 10 MB.' }, 413)
    }

    const backupPayload = parseJson(content)
    if (!backupPayload.ok) {
      return json({ error: 'Il file backup non contiene JSON valido' }, 400)
    }

    const inspection = inspectAuroraBackup(backupPayload.value)
    if (!inspection.backup || !inspection.normalizedBackup) {
      return json({
        mode: 'empty_account_restore',
        readiness: 'blocked',
        backup: {
          format: 'unknown',
          schemaVersion: null,
          createdAt: null,
          checksumValid: false,
        },
        currentState: null,
        summary: {
          backupRecords: 0,
          creatableRecords: 0,
          collisions: 0,
          duplicates: 0,
          missingReferences: 0,
          blockingErrors: inspection.summary.errorCount,
          warnings: inspection.summary.warningCount,
        },
        accountingPreview: null,
        restorePlan: [],
        issues: inspection.issues,
      }, 200)
    }

    const snapshot = await fetchCurrentUserDataSnapshot(supabase, user)
    const result = runRestoreDryRun({
      backup: inspection.normalizedBackup,
      inspectionIssues: inspection.issues,
      snapshot,
      options: { mode: 'empty_account_restore' },
    })

    if (process.env.NODE_ENV === 'development') {
      const userId_prefix = user.id.slice(0, 8)
      console.log('[aurora-dry-run]', JSON.stringify({ ...summarizeDryRunForLog(result), userId_prefix }))
    }

    return json(result, 200)
  } catch (error) {
    if (error instanceof Error) {
      console.error('[aurora-backup-dry-run]', error.name, error.message)
    }
    return json({ error: 'Non è stato possibile verificare il backup. Nessun dato è stato modificato.' }, 500)
  }
}

export async function GET() {
  return json({ error: 'Metodo non supportato' }, 405)
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function parseJson(value: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(value) as unknown }
  } catch {
    return { ok: false }
  }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length
}
