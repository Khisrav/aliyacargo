import { createError, getRouterParam, readBody } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { GOODS_SELECT, mapGoodRow, useSupabaseAdmin } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const user = requireTelegramAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id' })
  }

  if (event.method !== 'PATCH') {
    throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
  }

  const body = await readBody<{ has_paid?: boolean }>(event)
  if (typeof body.has_paid !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'Укажите has_paid' })
  }

  const supabase = useSupabaseAdmin()
  const now = new Date().toISOString()
  const acceptedBy = user.username ?? user.first_name ?? String(user.id)

  const patch = body.has_paid
    ? {
        has_paid: true,
        paid_at: now,
        payment_accepted_by: acceptedBy,
        updated_at: now,
      }
    : {
        has_paid: false,
        paid_at: null,
        payment_accepted_by: null,
        updated_at: now,
      }

  const { data, error } = await supabase
    .from('goods')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select(GOODS_SELECT)
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return mapGoodRow(data as Record<string, any>)
})
