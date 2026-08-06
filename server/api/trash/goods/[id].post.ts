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

  const { data: good, error: findError } = await supabase
    .from('goods')
    .select('id, client_id, deleted_at, clients ( deleted_at )')
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .maybeSingle()

  if (findError) {
    throw createError({ statusCode: 500, statusMessage: findError.message })
  }
  if (!good) {
    throw createError({ statusCode: 404, statusMessage: 'Запись не найдена в корзине' })
  }

  const clientDeleted = Boolean((good as any).clients?.deleted_at)
  if (clientDeleted) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Сначала восстановите клиента — запись привязана к удалённому клиенту',
    })
  }

  const { error } = await supabase
    .from('goods')
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { ok: true, id }
})
