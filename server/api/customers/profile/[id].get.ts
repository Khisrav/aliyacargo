import { createError } from 'h3'
import { requireTelegramAuth } from '../../../utils/auth'
import { GOODS_SELECT, mapGoodRow, useSupabaseAdmin, type CustomerGood } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Неверный идентификатор клиента' })
  }

  const supabase = useSupabaseAdmin()

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, phone, name, created_at, updated_at')
    .eq('id', id)
    .maybeSingle()

  if (customerError) {
    throw createError({ statusCode: 500, statusMessage: customerError.message })
  }

  if (!customer) {
    throw createError({ statusCode: 404, statusMessage: 'Клиент не найден' })
  }

  const { data: goodsRows, error: goodsError } = await supabase
    .from('goods')
    .select(GOODS_SELECT)
    .eq('customer_id', id)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (goodsError) {
    throw createError({ statusCode: 500, statusMessage: goodsError.message })
  }

  const goods: CustomerGood[] = (goodsRows ?? []).map(mapGoodRow)

  const totalCount = goods.length
  const totalWeight = goods.reduce((sum, g) => sum + g.weight, 0)
  const totalRevenue = goods.reduce((sum, g) => sum + g.price, 0)
  const paidRows = goods.filter(g => g.has_paid)
  const unpaidRows = goods.filter(g => !g.has_paid)
  const paidCount = paidRows.length
  const unpaidCount = unpaidRows.length
  const paidRevenue = paidRows.reduce((sum, g) => sum + g.price, 0)
  const unpaidRevenue = unpaidRows.reduce((sum, g) => sum + g.price, 0)
  const paidWeight = paidRows.reduce((sum, g) => sum + g.weight, 0)
  const unpaidWeight = unpaidRows.reduce((sum, g) => sum + g.weight, 0)
  const avgWeight = totalCount ? totalWeight / totalCount : 0
  const avgPrice = totalCount ? totalRevenue / totalCount : 0
  const paidRate = totalCount ? (paidCount / totalCount) * 100 : 0

  const firstAt = goods.length
    ? goods.reduce((min, g) => (g.created_at < min ? g.created_at : min), goods[0]!.created_at)
    : null
  const lastAt = goods.length
    ? goods.reduce((max, g) => (g.created_at > max ? g.created_at : max), goods[0]!.created_at)
    : null

  return {
    customer,
    stats: {
      totalCount,
      totalWeight,
      totalRevenue,
      paidCount,
      unpaidCount,
      paidRevenue,
      unpaidRevenue,
      paidWeight,
      unpaidWeight,
      avgWeight,
      avgPrice,
      paidRate,
      firstAt,
      lastAt,
    },
    goods,
  }
})
