import type { SupabaseClient } from '@supabase/supabase-js'
import { resolvePreferences } from './preferences-defaults'
import type {
  CreateSourceMuteInput,
  NotificationPreference,
  NotificationSourceMute,
  NotificationUserSettings,
  ResolvedPreferences,
  UpdatePreferenceInput,
  UpdateUserSettingsInput,
} from './preferences-types'
import type { NotificationType } from './types'

// ── Load all preferences in one pass ─────────────────────────────────────────

/**
 * Loads user settings, per-type preferences, and source mutes in parallel.
 * Returns a ResolvedPreferences object ready for the engine.
 */
export async function loadResolvedPreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<ResolvedPreferences> {
  const [settingsResult, prefsResult, mutesResult] = await Promise.all([
    supabase
      .from('notification_user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle() as unknown as Promise<{ data: NotificationUserSettings | null; error: unknown }>,
    supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId) as unknown as Promise<{ data: NotificationPreference[] | null; error: unknown }>,
    supabase
      .from('notification_source_mutes')
      .select('*')
      .eq('user_id', userId) as unknown as Promise<{ data: NotificationSourceMute[] | null; error: unknown }>,
  ])

  return resolvePreferences(
    settingsResult.data ?? null,
    prefsResult.data ?? [],
    mutesResult.data ?? [],
  )
}

// ── User settings ─────────────────────────────────────────────────────────────

export async function getUserSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<NotificationUserSettings | null> {
  const { data } = await supabase
    .from('notification_user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle() as unknown as { data: NotificationUserSettings | null }
  return data
}

export async function upsertUserSettings(
  supabase: SupabaseClient,
  userId: string,
  patch: UpdateUserSettingsInput,
): Promise<NotificationUserSettings> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('notification_user_settings')
    .upsert(
      { user_id: userId, ...patch, updated_at: now },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single() as unknown as { data: NotificationUserSettings | null; error: unknown }

  if (error || !data) throw new Error('Failed to save notification settings')
  return data
}

// ── Per-type preferences ──────────────────────────────────────────────────────

export async function listPreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<NotificationPreference[]> {
  const { data } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId) as unknown as { data: NotificationPreference[] | null }
  return data ?? []
}

export async function upsertPreference(
  supabase: SupabaseClient,
  userId: string,
  type: NotificationType,
  patch: UpdatePreferenceInput,
): Promise<NotificationPreference> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id:           userId,
        notification_type: type,
        is_enabled:        patch.is_enabled ?? true,
        config:            patch.config ?? {},
        updated_at:        now,
      },
      { onConflict: 'user_id,notification_type' },
    )
    .select('*')
    .single() as unknown as { data: NotificationPreference | null; error: unknown }

  if (error || !data) throw new Error(`Failed to save preference for ${type}`)
  return data
}

export async function resetPreferences(
  supabase: SupabaseClient,
  userId: string,
  types?: NotificationType[],
): Promise<void> {
  let query = supabase
    .from('notification_preferences')
    .delete()
    .eq('user_id', userId) as unknown as ReturnType<typeof supabase.from>

  if (types && types.length > 0) {
    query = (query as unknown as { in: (col: string, vals: string[]) => unknown })
      .in('notification_type', types) as unknown as ReturnType<typeof supabase.from>
  }
  await query
}

// ── Source mutes ──────────────────────────────────────────────────────────────

export async function listSourceMutes(
  supabase: SupabaseClient,
  userId: string,
  page = 1,
  limit = 50,
): Promise<{ data: NotificationSourceMute[]; total: number }> {
  const offset = (page - 1) * limit
  const { data, count } = await supabase
    .from('notification_source_mutes')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1) as unknown as { data: NotificationSourceMute[] | null; count: number | null }

  return { data: data ?? [], total: count ?? 0 }
}

export async function createSourceMute(
  supabase: SupabaseClient,
  userId: string,
  input: CreateSourceMuteInput,
): Promise<NotificationSourceMute> {
  const now = new Date().toISOString()

  // Upsert: if an equivalent mute exists, update it
  const { data, error } = await supabase
    .from('notification_source_mutes')
    .upsert(
      {
        user_id:           userId,
        source_type:       input.source_type,
        source_id:         input.source_id,
        notification_type: input.notification_type ?? null,
        muted_until:       input.muted_until ?? null,
        reason:            input.reason ?? null,
        updated_at:        now,
      },
      { onConflict: 'user_id,source_type,source_id,notification_type' },
    )
    .select('*')
    .single() as unknown as { data: NotificationSourceMute | null; error: unknown }

  if (error || !data) throw new Error('Failed to create source mute')
  return data
}

export async function deleteSourceMute(
  supabase: SupabaseClient,
  userId: string,
  muteId: string,
): Promise<void> {
  const { error } = await supabase
    .from('notification_source_mutes')
    .delete()
    .eq('id', muteId)
    .eq('user_id', userId) as unknown as { error: unknown }
  if (error) throw new Error('Failed to delete source mute')
}

export async function getSourceMute(
  supabase: SupabaseClient,
  userId: string,
  muteId: string,
): Promise<NotificationSourceMute | null> {
  const { data } = await supabase
    .from('notification_source_mutes')
    .select('*')
    .eq('id', muteId)
    .eq('user_id', userId)
    .maybeSingle() as unknown as { data: NotificationSourceMute | null }
  return data
}

// ── Snooze ───────────────────────────────────────────────────────────────────

export async function snoozeNotification(
  supabase: SupabaseClient,
  userId: string,
  notificationId: string,
  snoozedUntil: Date,
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('notifications')
    .update({
      snoozed_until:   snoozedUntil.toISOString(),
      last_snoozed_at: now,
      updated_at:      now,
    })
    .eq('id', notificationId)
    .eq('user_id', userId)
  if (error) throw new Error('Failed to snooze notification')
}

export async function unsnoozeNotification(
  supabase: SupabaseClient,
  userId: string,
  notificationId: string,
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('notifications')
    .update({
      snoozed_until: null,
      updated_at:    now,
    })
    .eq('id', notificationId)
    .eq('user_id', userId)
  if (error) throw new Error('Failed to unsnooze notification')
}

/**
 * Validates source ownership — checks that the source_id belongs to the user.
 * Returns the entity name for the UI, or null if not found/not owned.
 */
export async function validateSourceOwnership(
  supabase: SupabaseClient,
  userId: string,
  sourceType: string,
  sourceId: string,
): Promise<{ name: string } | null> {
  const TABLE_MAP: Record<string, string> = {
    account:      'accounts',
    budget:       'budgets',
    recurring_rule: 'recurring_rules',
    savings_goal: 'savings_goals',
    loan:         'loans',
    automation:   'automation_rules',
    transaction:  'transactions',
  }
  const table = TABLE_MAP[sourceType]
  if (!table) return null

  const selectCol = ['budget', 'transaction'].includes(sourceType) ? 'id' : 'id, name'
  const { data } = await supabase
    .from(table)
    .select(selectCol)
    .eq('id', sourceId)
    .eq('user_id', userId)
    .maybeSingle() as unknown as { data: { id: string; name?: string } | null }

  if (!data) return null
  return { name: data.name ?? sourceId }
}
