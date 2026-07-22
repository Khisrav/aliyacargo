import { createError, readBody } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { GOODS_SELECT, mapGoodRow, useSupabaseAdmin } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const user = requireTelegramAuth(event)

  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody<{ has_paid?: boolean }>(event)

  if (!Number.isFinite(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Неверный идентификатор записи' })
  }

  if (typeof body.has_paid !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'Поле has_paid должно быть булевым значением' })
  }

  const initiator = user.username ?? String(user.id)
  const supabase = useSupabaseAdmin()
  const { data, error } = await supabase
    .from('goods')
    .update({
      has_paid: body.has_paid,
      initiator,
    })
    .eq('id', id)
    .select(GOODS_SELECT)
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return mapGoodRow(data as Record<string, any>)
})
