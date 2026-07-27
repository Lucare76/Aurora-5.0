import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

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
import { normalizeDashboardPreferences, preferencesToRow } from '@/lib/dashboard/preferences'
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
  const startedAt = Date.now()
  try {
    if (process.env.ENABLE_BACKUP_RESTORE_REAL !== 'true') return json(error('RESTORE_DISABLED'), 403)

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
      console.error('[aurora-restore] token-lookup-error', { pgCode: tokenError.code })
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
      const mappedCode = mapRpcError(rpcError.message)
      console.error('[aurora-restore]', {
        uid: user.id.slice(0, 8),
        code: mappedCode,
        pgCode: rpcError.code,
        duration: Date.now() - startedAt,
      })
      return json(error(mappedCode), 409)
    }

    const rpcData = data as { counts?: Record<string, number>; reconciledCategories?: number } | null
    console.info('[aurora-restore]', {
      uid: user.id.slice(0, 8),
      checksum: validated.checksum.slice(0, 16),
      records: Object.values(rpcData?.counts ?? {}).reduce((acc, v) => acc + v, 0),
      reconciled: rpcData?.reconciledCategories ?? 0,
      duration: Date.now() - startedAt,
    })

    // Restore notification preferences (steps 14/15 from migration 00021).
    // Non-fatal: tables may not exist if migration hasn't been applied yet.
    // notification_source_mutes (step 16) excluded — source_id requires UUID remapping.
    await restoreNotificationPreferences(supabase as unknown as SupabaseClient, user.id, validated.backup)
    await restoreDashboardPreferences(supabase as unknown as SupabaseClient, user.id, validated.backup)
    await restoreDataIntegrityStates(supabase as unknown as SupabaseClient, user.id, validated.backup)

    return json({
      status: 'completed',
      restore: data,
      checksum: validated.checksum,
    }, 200)
  } catch (err) {
    if (err instanceof RestoreNotReadyError) return json(error('RESTORE_NOT_READY'), 409)
    if (err instanceof RestorePreparationError) return json(error(err.code), err.code === 'INVALID_BACKUP' ? 400 : 409)
    if (err instanceof Error) console.error('[aurora-restore]', { name: err.name, duration: Date.now() - startedAt })
    return json(error('INTERNAL_ERROR'), 500)
  }
}

export async function GET() {
  return json(error('METHOD_NOT_SUPPORTED'), 405)
}

async function restoreDataIntegrityStates(
  db: SupabaseClient,
  userId: string,
  backup: NonNullable<Awaited<ReturnType<typeof validateBackupForRealRestore>>['backup']>,
) {
  const issues = backup.data.dataIntegrityIssues ?? []
  if (issues.length === 0) return
  try {
    for (const item of issues.filter((issue) => issue.status === 'ignored' || issue.status === 'acknowledged')) {
      await db
        .from('data_integrity_issues')
        .update({
          status: item.status,
          ignored_reason: item.status === 'ignored' ? item.ignored_reason ?? null : null,
          ignored_at: item.status === 'ignored' ? item.ignored_at ?? new Date().toISOString() : null,
          acknowledged_at: item.status === 'acknowledged' ? item.acknowledged_at ?? new Date().toISOString() : null,
        })
        .eq('user_id', userId)
        .eq('fingerprint', item.fingerprint)
    }
  } catch (stateErr) {
    console.warn('[aurora-restore] data-integrity-state-restore-skipped', {
      uid: userId.slice(0, 8),
      error: stateErr instanceof Error ? stateErr.message : String(stateErr),
    })
  }
}

async function restoreDashboardPreferences(
  db: SupabaseClient,
  userId: string,
  backup: NonNullable<Awaited<ReturnType<typeof validateBackupForRealRestore>>['backup']>,
) {
  const preferences = backup.data.dashboardPreferences
  if (!preferences) return

  try {
    const normalized = normalizeDashboardPreferences({
      visibleWidgets: preferences.visible_widgets,
      widgetOrder: preferences.widget_order,
      compactMode: preferences.compact_mode,
      defaultPeriod: preferences.default_period,
    })
    await db.from('dashboard_preferences').upsert(preferencesToRow(userId, normalized), { onConflict: 'user_id' })
  } catch (prefErr) {
    console.warn('[aurora-restore] dashboard-preferences-restore-skipped', {
      uid: userId.slice(0, 8),
      error: prefErr instanceof Error ? prefErr.message : String(prefErr),
    })
  }
}

async function restoreNotificationPreferences(
  db: SupabaseClient,
  userId: string,
  backup: NonNullable<Awaited<ReturnType<typeof validateBackupForRealRestore>>['backup']>,
) {
  const { notificationUserSettings, notificationPreferences } = backup.data
  if (!notificationUserSettings && !notificationPreferences?.length) return

  try {
    if (notificationUserSettings) {
      const s = notificationUserSettings
      await db.from('notification_user_settings').upsert({
        user_id: userId,
        notifications_enabled: s.notifications_enabled,
        show_info: s.show_info,
        show_warning: s.show_warning,
        show_critical: s.show_critical,
        quiet_hours_enabled: s.quiet_hours_enabled,
        quiet_hours_start: s.quiet_hours_start ?? null,
        quiet_hours_end: s.quiet_hours_end ?? null,
        timezone: s.timezone ?? null,
        digest_enabled: s.digest_enabled,
        digest_frequency: s.digest_frequency ?? null,
        digest_time: s.digest_time ?? null,
      }, { onConflict: 'user_id' })
    }
    if (notificationPreferences?.length) {
      await db.from('notification_preferences').delete().eq('user_id', userId)
      await db.from('notification_preferences').insert(
        notificationPreferences.map((p) => ({
          id: p.id,
          user_id: userId,
          notification_type: p.notification_type,
          is_enabled: p.is_enabled,
          config: p.config ?? {},
        })),
      )
    }
  } catch (prefErr) {
    console.warn('[aurora-restore] notification-preferences-restore-skipped', {
      uid: userId.slice(0, 8),
      error: prefErr instanceof Error ? prefErr.message : String(prefErr),
    })
  }
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
    'UUID_CONFLICT',
    'ACCOUNTING_MISMATCH',
  ]
  return known.find((code) => message.includes(code)) ?? 'RESTORE_ROLLED_BACK'
}
