import { createError, getRouterParam } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { GOODS_SELECT, mapGoodRow, useSupabaseAdmin } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id клиента' })
  }

  const supabase = useSupabaseAdmin()
  const { data: client, error } = await supabase
    .from('clients')
    .select('id, name, phone, created_at, updated_at')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  if (!client) {
    throw createError({ statusCode: 404, statusMessage: 'Клиент не найден' })
  }

  const { data: goods, error: goodsError } = await supabase
    .from('goods')
    .select(GOODS_SELECT)
    .eq('client_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (goodsError) {
    throw createError({ statusCode: 500, statusMessage: goodsError.message })
  }

  const mapped = (goods ?? []).map(row => mapGoodRow(row as Record<string, any>))
  const unpaid = mapped.filter(g => !g.has_paid)

  return {
    client: {
      id: Number(client.id),
      name: String(client.name),
      phone: String(client.phone),
      created_at: String(client.created_at),
      updated_at: String(client.updated_at),
    },
    goods: mapped,
    totals: {
      goodsCount: mapped.length,
      totalWeight: Math.round(mapped.reduce((s, g) => s + g.weight, 0) * 1000) / 1000,
      totalRevenue: Math.round(mapped.reduce((s, g) => s + g.price, 0) * 100) / 100,
      unpaidCount: unpaid.length,
      unpaidRevenue: Math.round(unpaid.reduce((s, g) => s + g.price, 0) * 100) / 100,
      unpaidWeight: Math.round(unpaid.reduce((s, g) => s + g.weight, 0) * 1000) / 1000,
    },
  }
})
