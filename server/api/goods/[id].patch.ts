import { createError, readBody } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)

  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody<{ has_paid?: boolean }>(event)

  if (!Number.isFinite(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Неверный идентификатор записи' })
  }

  if (typeof body.has_paid !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'Поле has_paid должно быть булевым значением' })
  }

  const supabase = useSupabaseAdmin()
  const { data, error } = await supabase
    .from('goods')
    .update({ has_paid: body.has_paid })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
