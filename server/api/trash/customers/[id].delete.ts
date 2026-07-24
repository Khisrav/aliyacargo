import { createError } from 'h3'
import { requireTelegramAuth } from '../../../utils/auth'
import { useSupabaseAdmin } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Неверный идентификатор клиента' })
  }

  const deletedAt = new Date().toISOString()
  const supabase = useSupabaseAdmin()

  const { data: customer, error: findError } = await supabase
    .from('customers')
    .select('id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (findError) {
    throw createError({ statusCode: 500, statusMessage: findError.message })
  }

  if (!customer) {
    throw createError({ statusCode: 404, statusMessage: 'Клиент не найден' })
  }

  const { error: goodsError } = await supabase
    .from('goods')
    .update({ deleted_at: deletedAt })
    .eq('customer_id', id)
    .is('deleted_at', null)

  if (goodsError) {
    throw createError({ statusCode: 500, statusMessage: goodsError.message })
  }

  const { error: customerError } = await supabase
    .from('customers')
    .update({ deleted_at: deletedAt, updated_at: deletedAt })
    .eq('id', id)

  if (customerError) {
    throw createError({ statusCode: 500, statusMessage: customerError.message })
  }

  return { ok: true, id }
})
