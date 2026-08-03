import { createError } from 'h3'
import { useSupabaseAdmin } from './supabase'
import { isValidPhone, normalizePhone } from '#shared/utils/phone'

/** Find or create an active client by 9-digit phone; update name if changed. */
export async function upsertClientByPhone(phoneRaw: string, nameRaw: string) {
  const phone = normalizePhone(phoneRaw)
  const name = nameRaw.trim()

  if (!isValidPhone(phone)) {
    throw createError({ statusCode: 400, statusMessage: 'Телефон должен содержать 9 цифр' })
  }
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Укажите имя клиента' })
  }

  const supabase = useSupabaseAdmin()

  const { data: existing, error: lookupError } = await supabase
    .from('clients')
    .select('id, phone, name')
    .eq('phone', phone)
    .is('deleted_at', null)
    .maybeSingle()

  if (lookupError) {
    throw createError({ statusCode: 500, statusMessage: lookupError.message })
  }

  if (existing) {
    if (existing.name !== name) {
      const { error: updateError } = await supabase
        .from('clients')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', existing.id)

      if (updateError) {
        throw createError({ statusCode: 500, statusMessage: updateError.message })
      }
    }
    return { id: Number(existing.id), phone, name }
  }

  const { data: trashed } = await supabase
    .from('clients')
    .select('id')
    .eq('phone', phone)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (trashed) {
    const { error: restoreError } = await supabase
      .from('clients')
      .update({ name, deleted_at: null, updated_at: new Date().toISOString() })
      .eq('id', trashed.id)

    if (restoreError) {
      throw createError({ statusCode: 500, statusMessage: restoreError.message })
    }
    return { id: Number(trashed.id), phone, name }
  }

  const { data: created, error: createErrorDb } = await supabase
    .from('clients')
    .insert({ phone, name })
    .select('id')
    .single()

  if (createErrorDb) {
    throw createError({ statusCode: 500, statusMessage: createErrorDb.message })
  }

  return { id: Number(created.id), phone, name }
}
