import { createError } from 'h3'
import { requireTelegramAuth } from '../../../utils/auth'
import { useSupabaseAdmin } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Неверный идентификатор записи' })
  }

  const supabase = useSupabaseAdmin()

  const { data, error: findError } = await supabase
    .from('finance_records')
    .select('id')
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .maybeSingle()

  if (findError) {
    throw createError({ statusCode: 500, statusMessage: findError.message })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Запись не найдена в корзине' })
  }

  const { error } = await supabase
    .from('finance_records')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { ok: true, id }
})
