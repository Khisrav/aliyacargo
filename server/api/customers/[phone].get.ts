import { createError } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'
import { isValidPhone, normalizePhone } from '../../../shared/utils/phone'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)

  const raw = getRouterParam(event, 'phone') || ''
  const phone = normalizePhone(raw)

  if (!isValidPhone(phone)) {
    throw createError({ statusCode: 400, statusMessage: 'Телефон должен содержать 9 цифр' })
  }

  const supabase = useSupabaseAdmin()
  const { data, error } = await supabase
    .from('customers')
    .select('id, phone, name, created_at, updated_at')
    .eq('phone', phone)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
