import { createError, getRouterParam } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { GOODS_SELECT, mapGoodRow, useSupabaseAdmin } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id' })
  }

  const supabase = useSupabaseAdmin()
  const { data, error } = await supabase
    .from('goods')
    .select(GOODS_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Запись не найдена' })
  }

  return mapGoodRow(data as Record<string, any>)
})
