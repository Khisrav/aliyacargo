import { createError, getRouterParam } from 'h3'
import { requireTelegramAuth } from '../../../utils/auth'
import { addGood, buildAcceptanceStats, emptyAggregate, money, rate, weight } from '../../../utils/acceptanceStats'
import { useSupabaseAdmin } from '../../../utils/supabase'
import type { AcceptanceStatsClient, AcceptanceStatsDetail } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<AcceptanceStatsDetail> => {
  requireTelegramAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id приёмки' })
  }

  const supabase = useSupabaseAdmin()

  const { data: acceptance, error } = await supabase
    .from('acceptances')
    .select('id, accepted_at, total_weight, paid_tjs, cost_per_kg, status, closed_at, waste_weight')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  if (!acceptance) {
    throw createError({ statusCode: 404, statusMessage: 'Приёмка не найдена' })
  }

  const { data: goods, error: goodsError } = await supabase
    .from('goods')
    .select('client_id, weight, price, has_paid, paid_at, clients(id, name, phone)')
    .eq('acceptance_id', id)
    .is('deleted_at', null)
    .limit(20000)

  if (goodsError) {
    throw createError({ statusCode: 500, statusMessage: goodsError.message })
  }

  const agg = emptyAggregate()
  const clientMap = new Map<number, AcceptanceStatsClient>()

  for (const row of goods ?? []) {
    const good = row as Record<string, any>
    addGood(agg, good)

    const clientId = Number(good.client_id)
    const joined = good.clients ?? {}
    let client = clientMap.get(clientId)
    if (!client) {
      client = {
        id: clientId,
        name: String(joined.name ?? ''),
        phone: String(joined.phone ?? ''),
        goods_count: 0,
        weight: 0,
        total: 0,
        paid: 0,
        unpaid: 0,
      }
      clientMap.set(clientId, client)
    }

    const price = Number(good.price)
    client.goods_count += 1
    client.weight += Number(good.weight)
    client.total += price
    if (good.has_paid) client.paid += price
    else client.unpaid += price
  }

  const base = buildAcceptanceStats(acceptance as Record<string, any>, agg)

  const clients = [...clientMap.values()]
    .map(c => ({
      ...c,
      weight: weight(c.weight),
      total: money(c.total),
      paid: money(c.paid),
      unpaid: money(c.unpaid),
    }))
    .sort((a, b) => b.unpaid - a.unpaid || b.total - a.total)

  return {
    ...base,
    price_per_kg: agg.sorted_weight ? Math.round((agg.total_revenue / agg.sorted_weight) * 100) / 100 : 0,
    waste_rate: rate(base.waste_weight ?? 0, base.total_weight),
    paid_weight: weight(agg.paid_weight),
    unpaid_weight: weight(agg.unpaid_weight),
    first_payment_at: agg.first_payment_at,
    last_payment_at: agg.last_payment_at,
    clients,
  }
})
