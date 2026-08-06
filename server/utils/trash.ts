import type { SupabaseClient } from '@supabase/supabase-js'

export const TRASH_RETENTION_DAYS = 14

export function trashCutoffIso(days = TRASH_RETENTION_DAYS) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

export function daysLeftInTrash(deletedAt: string | null | undefined, days = TRASH_RETENTION_DAYS) {
  if (!deletedAt) return days
  const deleted = new Date(deletedAt).getTime()
  const purgeAt = deleted + days * 24 * 60 * 60 * 1000
  return Math.max(0, Math.ceil((purgeAt - Date.now()) / (24 * 60 * 60 * 1000)))
}

/** Permanently remove trash items older than retention period. */
export async function purgeExpiredTrash(supabase: SupabaseClient) {
  const cutoff = trashCutoffIso()

  // Goods first (FK → clients)
  await supabase
    .from('goods')
    .delete()
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff)

  await supabase
    .from('finance_records')
    .delete()
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff)

  await supabase
    .from('clients')
    .delete()
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff)
}
