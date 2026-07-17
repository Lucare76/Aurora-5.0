import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  assertJsonFilename,
  buildRestoreRpcPayload,
  byteLength,
  getAuthenticatedRestoreUser,
  MAX_RESTORE_BACKUP_BYTES,
  parseJsonSafely,
  readRestoreSnapshot,
  RESTORE_CONFIRMATION_PHRASE,
  RestoreNotReadyError,
  RestorePreparationError,
  validateBackupForRealRestore,
} from '@/lib/backup'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  filename: z.string().min(1).max(255),
  content: z.string().min(1),
  tokenId: z.string().uuid(),
  token: z.string().min(32),
  confirmation: z.string(),
}).strict()

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await getAuthenticatedRestoreUser(supabase)
    if (!user) return json(error('UNAUTHENTICATED'), 401)

    const rawBody = await request.text()
    if (byteLength(rawBody) > MAX_RESTORE_BACKUP_BYTES) return json(error('PAYLOAD_TOO_LARGE'), 413)

    const body = parseJsonSafely(rawBody)
    if (!body.ok) return json(error('INVALID_BACKUP'), 400)

    const parsed = requestSchema.safeParse(body.value)
    if (!parsed.success) return json(error('INVALID_BACKUP'), 400)

    const { filename, content, tokenId, token, confirmation } = parsed.data
    if (confirmation !== RESTORE_CONFIRMATION_PHRASE) return json(error('CONFIRMATION_REQUIRED'), 400)
    if (!assertJsonFilename(filename)) return json(error('INVALID_BACKUP_FILE_TYPE'), 415)
    if (byteLength(content) > MAX_RESTORE_BACKUP_BYTES) return json(error('PAYLOAD_TOO_LARGE'), 413)

    const snapshot = await readRestoreSnapshot(supabase, user)
    const validated = await validateBackupForRealRestore(content, snapshot)

    const { data: tokenRow, error: tokenError } = await supabase
      .from('backup_restore_tokens')
      .select('id,backup_checksum,schema_version,mode,readiness,expires_at,used_at')
      .eq('id', tokenId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (tokenError) {
      console.error('[aurora-restore]', tokenError.message)
      return json(error('INTERNAL_ERROR'), 500)
    }
    if (!tokenRow) return json(error('TOKEN_INVALID'), 403)
    if (tokenRow.used_at) return json(error('TOKEN_ALREADY_USED'), 409)
    if (new Date(tokenRow.expires_at).getTime() <= Date.now()) return json(error('TOKEN_EXPIRED'), 410)
    if (
      tokenRow.backup_checksum !== validated.checksum ||
      tokenRow.schema_version !== validated.backup.schemaVersion ||
      tokenRow.mode !== 'empty_account_restore' ||
      tokenRow.readiness !== 'ready'
    ) {
      return json(error('TOKEN_INVALID'), 403)
    }

    const { data, error: rpcError } = await supabase.rpc('restore_aurora_backup_v1_empty_account', {
      p_token_id: tokenId,
      p_token: token,
      p_backup: buildRestoreRpcPayload(validated.backup),
    })

    if (rpcError) {
      console.error('[aurora-restore-rpc]', rpcError.message)
      return json(error(mapRpcError(rpcError.message)), 409)
    }

    return json({
      status: 'completed',
      restore: data,
      checksum: validated.checksum,
    }, 200)
  } catch (err) {
    if (err instanceof RestoreNotReadyError) return json(error('RESTORE_NOT_READY'), 409)
    if (err instanceof RestorePreparationError) return json(error(err.code), err.code === 'INVALID_BACKUP' ? 400 : 409)
    if (err instanceof Error) console.error('[aurora-restore]', err.name, err.message)
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

function mapRpcError(message: string): string {
  const known = [
    'UNAUTHENTICATED',
    'INVALID_BACKUP',
    'TOKEN_INVALID',
    'TOKEN_ALREADY_USED',
    'ACCOUNT_NOT_EMPTY',
    'ACCOUNTING_MISMATCH',
  ]
  return known.find((code) => message.includes(code)) ?? 'RESTORE_ROLLED_BACK'
}
