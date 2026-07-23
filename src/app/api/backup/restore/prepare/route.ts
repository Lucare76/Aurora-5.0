import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  assertJsonFilename,
  buildRestorePreparation,
  byteLength,
  getAuthenticatedRestoreUser,
  MAX_RESTORE_BACKUP_BYTES,
  parseJsonSafely,
  readRestoreSnapshot,
  RestoreNotReadyError,
  RestorePreparationError,
} from '@/lib/backup'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  filename: z.string().min(1).max(255),
  content: z.string().min(1),
}).strict()

export async function POST(request: Request) {
  try {
    if (process.env.ENABLE_BACKUP_RESTORE_REAL !== 'true') return json(error('RESTORE_DISABLED'), 403)

    const supabase = await createClient()
    const user = await getAuthenticatedRestoreUser(supabase)
    if (!user) return json(error('UNAUTHENTICATED'), 401)

    const rawBody = await request.text()
    if (byteLength(rawBody) > MAX_RESTORE_BACKUP_BYTES) {
      return json(error('PAYLOAD_TOO_LARGE'), 413)
    }

    const body = parseJsonSafely(rawBody)
    if (!body.ok) return json(error('INVALID_BACKUP'), 400)

    const parsed = requestSchema.safeParse(body.value)
    if (!parsed.success) return json(error('INVALID_BACKUP'), 400)

    const { filename, content } = parsed.data
    if (!assertJsonFilename(filename)) return json(error('INVALID_BACKUP_FILE_TYPE'), 415)
    if (byteLength(content) > MAX_RESTORE_BACKUP_BYTES) return json(error('PAYLOAD_TOO_LARGE'), 413)

    const snapshot = await readRestoreSnapshot(supabase, user)
    const prepared = await buildRestorePreparation(content, snapshot)

    const { data, error: insertError } = await supabase
      .from('backup_restore_tokens')
      .insert({
        user_id: user.id,
        token_hash: prepared.token.tokenHash,
        backup_checksum: prepared.checksum,
        schema_version: prepared.backup.schemaVersion,
        mode: 'empty_account_restore',
        readiness: 'ready',
        expires_at: prepared.token.expiresAt,
      })
      .select('id,expires_at')
      .single()

    if (insertError) {
      console.error('[aurora-restore-prepare] insert-error', { pgCode: insertError.code })
      return json(error('INTERNAL_ERROR'), 500)
    }

    return json({
      tokenId: data.id,
      token: prepared.token.token,
      expiresAt: data.expires_at,
      checksum: prepared.checksum,
      requiredConfirmation: prepared.requiredConfirmation,
      summary: prepared.dryRun.summary,
      accountingPreview: prepared.dryRun.accountingPreview,
    }, 200)
  } catch (err) {
    if (err instanceof RestoreNotReadyError) {
      return json({ ...error('RESTORE_NOT_READY'), dryRun: err.dryRun }, 409)
    }
    if (err instanceof RestorePreparationError) {
      return json(error(err.code), err.code === 'INVALID_BACKUP' ? 400 : 409)
    }
    if (err instanceof Error) {
      console.error('[aurora-restore-prepare]', { name: err.name })
    }
    return json(error('INTERNAL_ERROR'), 500)
  }
}

export async function GET() {
  return json(error('METHOD_NOT_SUPPORTED'), 405)
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

function error(code: string) {
  return { error: code }
}
