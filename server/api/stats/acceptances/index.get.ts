import { createError } from 'h3'
import { requireTelegramAuth } from '../../../utils/auth'
import { addGood, buildAcceptanceStats, emptyAggregate } from '../../../utils/acceptanceStats'
import { useSupabaseAdmin } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)
  const supabase = useSupabaseAdmin()

  const { data: acceptances, error } = await supabase
    .from('acceptances')
    .select('id, accepted_at, total_weight, paid_tjs, cost_per_kg, status, closed_at, waste_weight')
    .is('deleted_at', null)
    .order('accepted_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(200)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows = acceptances ?? []
  if (!rows.length) return []

  const { data: goods, error: goodsError } = await supabase
    .from('goods')
    .select('acceptance_id, client_id, weight, price, has_paid, paid_at')
    .in('acceptance_id', rows.map(a => a.id))
    .is('deleted_at', null)
    .limit(20000)

  if (goodsError) {
    throw createError({ statusCode: 500, statusMessage: goodsError.message })
  }

  const byAcceptance = new Map<number, ReturnType<typeof emptyAggregate>>()
  for (const good of goods ?? []) {
    const id = Number(good.acceptance_id)
    let agg = byAcceptance.get(id)
    if (!agg) {
      agg = emptyAggregate()
      byAcceptance.set(id, agg)
    }
    addGood(agg, good as Record<string, any>)
  }

  return rows.map(row => buildAcceptanceStats(
    row as Record<string, any>,
    byAcceptance.get(Number(row.id)) ?? emptyAggregate(),
  ))
})
