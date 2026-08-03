import { createError, getRouterParam } from 'h3'
import { requireTelegramAuth } from '../../../utils/auth'
import { useSupabaseAdmin } from '../../../utils/supabase'
import { isValidPhone, normalizePhone } from '#shared/utils/phone'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)
  const phoneParam = getRouterParam(event, 'phone') || ''
  const phone = normalizePhone(phoneParam)

  if (!isValidPhone(phone)) {
    throw createError({ statusCode: 400, statusMessage: 'Телефон должен содержать 9 цифр' })
  }

  const supabase = useSupabaseAdmin()
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, phone')
    .eq('phone', phone)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
    ? { id: Number(data.id), name: String(data.name), phone: String(data.phone) }
    : null
})
