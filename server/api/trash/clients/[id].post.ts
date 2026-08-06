import { createError } from 'h3'
import { requireTelegramAuth } from '../../../utils/auth'
import { useSupabaseAdmin } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Неверный идентификатор клиента' })
  }

  const supabase = useSupabaseAdmin()

  const { data: client, error: findError } = await supabase
    .from('clients')
    .select('id, deleted_at')
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .maybeSingle()

  if (findError) {
    throw createError({ statusCode: 500, statusMessage: findError.message })
  }
  if (!client?.deleted_at) {
    throw createError({ statusCode: 404, statusMessage: 'Клиент не найден в корзине' })
  }

  const deletedAt = client.deleted_at

  const { error: goodsError } = await supabase
    .from('goods')
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq('client_id', id)
    .eq('deleted_at', deletedAt)

  if (goodsError) {
    throw createError({ statusCode: 500, statusMessage: goodsError.message })
  }

  const { error: clientError } = await supabase
    .from('clients')
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (clientError) {
    throw createError({ statusCode: 500, statusMessage: clientError.message })
  }

  return { ok: true, id }
})
