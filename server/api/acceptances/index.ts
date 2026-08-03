import { createError, getQuery, readBody } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { mapAcceptanceRow, useSupabaseAdmin } from '../../utils/supabase'

async function attachGoodsStats(acceptances: Array<Record<string, any>>) {
  if (!acceptances.length) return []
  const supabase = useSupabaseAdmin()
  const ids = acceptances.map(a => a.id)

  const { data: goods, error } = await supabase
    .from('goods')
    .select('acceptance_id, weight')
    .in('acceptance_id', ids)
    .is('deleted_at', null)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const byId = new Map<number, { weight: number, count: number }>()
  for (const g of goods ?? []) {
    const id = Number(g.acceptance_id)
    const cur = byId.get(id) ?? { weight: 0, count: 0 }
    cur.weight += Number(g.weight)
    cur.count += 1
    byId.set(id, cur)
  }

  return acceptances.map((row) => {
    const stats = byId.get(Number(row.id))
    return mapAcceptanceRow(row, {
      sorted_weight: stats ? Math.round(stats.weight * 1000) / 1000 : 0,
      goods_count: stats?.count ?? 0,
    })
  })
}

export default defineEventHandler(async (event) => {
  const user = requireTelegramAuth(event)
  const method = event.method

  if (method === 'GET') {
    const query = getQuery(event)
    const status = typeof query.status === 'string' ? query.status : 'all'

    const supabase = useSupabaseAdmin()
    let builder = supabase
      .from('acceptances')
      .select('*')
      .is('deleted_at', null)
      .order('accepted_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(200)

    if (status === 'open' || status === 'closed') {
      builder = builder.eq('status', status)
    }

    const { data, error } = await builder
    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    return attachGoodsStats(data ?? [])
  }

  if (method === 'POST') {
    const body = await readBody<{
      accepted_at?: string
      total_weight?: number | string
      paid_tjs?: number | string
    }>(event)

    const totalWeight = Number(body.total_weight)
    const paidTjs = Number(body.paid_tjs)
    const acceptedAt = typeof body.accepted_at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.accepted_at)
      ? body.accepted_at
      : new Date().toISOString().slice(0, 10)

    if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
      throw createError({ statusCode: 400, statusMessage: 'Общий вес должен быть больше 0' })
    }
    if (!Number.isFinite(paidTjs) || paidTjs < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Сумма оплаты посреднику некорректна' })
    }

    const costPerKg = Math.round((paidTjs / totalWeight) * 10000) / 10000
    const createdBy = user.username ?? String(user.id)
    const supabase = useSupabaseAdmin()

    const { data: openExisting } = await supabase
      .from('acceptances')
      .select('id')
      .eq('status', 'open')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()

    if (openExisting) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Уже есть открытая приёмка. Закройте её перед созданием новой.',
      })
    }

    const { data, error } = await supabase
      .from('acceptances')
      .insert({
        accepted_at: acceptedAt,
        total_weight: totalWeight,
        paid_tjs: Math.round(paidTjs * 100) / 100,
        cost_per_kg: costPerKg,
        status: 'open',
        created_by: createdBy,
      })
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') {
        throw createError({
          statusCode: 409,
          statusMessage: 'Уже есть открытая приёмка. Закройте её перед созданием новой.',
        })
      }
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    return mapAcceptanceRow(data as Record<string, any>, { sorted_weight: 0, goods_count: 0 })
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
