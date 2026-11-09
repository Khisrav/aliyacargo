import { createError, getQuery } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { addDateKeyDays, businessDayStart, parseDateParam } from '../../utils/period'
import { fetchAllPages } from '../../utils/pagination'
import { GOODS_SELECT, mapGoodRow, useSupabaseAdmin } from '../../utils/supabase'

/** Rows sent to the list; the totals still cover every match. */
const LIST_LIMIT = 300

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)
  const query = getQuery(event)

  const paid = typeof query.paid === 'string' ? query.paid : 'unpaid'
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const acceptanceId = query.acceptance_id != null ? Number(query.acceptance_id) : null
  const clientId = query.client_id != null ? Number(query.client_id) : null
  const paidFrom = parseDateParam(query.paidFrom, 'paidFrom')
  const paidTo = parseDateParam(query.paidTo, 'paidTo')

  if (paidFrom && paidTo && paidFrom > paidTo) {
    throw createError({ statusCode: 400, statusMessage: 'Дата «с» позже даты «по»' })
  }

  const supabase = useSupabaseAdmin()

  let clientIds: number[] | null = null
  if (search) {
    const digits = search.replace(/\D/g, '')
    const { data: clients } = await supabase
      .from('clients')
      .select('id')
      .is('deleted_at', null)
      .or(
        digits
          ? `name.ilike.%${search}%,phone.ilike.%${digits}%`
          : `name.ilike.%${search}%`,
      )
      .limit(200)

    clientIds = (clients ?? []).map(c => Number(c.id))
    if (!clientIds.length) {
      return { items: [], totals: { count: 0, weight: 0, price: 0 }, truncated: false }
    }
  }

  // Same filters for the visible list and for the totals, so the header always
  // sums every matching package and not just the rows on screen.
  function applyFilters<Q extends Record<string, any>>(builder: Q): Q {
    let q: any = builder.is('deleted_at', null)
    if (paid === 'paid') q = q.eq('has_paid', true)
    else if (paid === 'unpaid') q = q.eq('has_paid', false)
    if (paidFrom) q = q.gte('paid_at', businessDayStart(paidFrom).toISOString())
    if (paidTo) q = q.lt('paid_at', businessDayStart(addDateKeyDays(paidTo, 1)).toISOString())
    if (Number.isFinite(acceptanceId) && acceptanceId! > 0) q = q.eq('acceptance_id', acceptanceId)
    if (Number.isFinite(clientId) && clientId! > 0) q = q.eq('client_id', clientId)
    if (clientIds) q = q.in('client_id', clientIds)
    return q
  }

  const orderColumn = paidFrom || paidTo ? 'paid_at' : 'created_at'
  const listQuery = applyFilters(supabase.from('goods').select(GOODS_SELECT))
    .order(orderColumn, { ascending: false })
    .order('id', { ascending: false })
    .limit(LIST_LIMIT)

  const [listRes, all] = await Promise.all([
    listQuery,
    fetchAllPages<{ id: number, weight: number, price: number }>((from, to) =>
      applyFilters(supabase.from('goods').select('id, weight, price'))
        .order('id', { ascending: true })
        .range(from, to),
    ),
  ])

  if (listRes.error) {
    throw createError({ statusCode: 500, statusMessage: listRes.error.message })
  }

  const items = (listRes.data ?? []).map(row => mapGoodRow(row as Record<string, any>))

  return {
    items,
    totals: {
      count: all.length,
      weight: Math.round(all.reduce((s, g) => s + Number(g.weight), 0) * 1000) / 1000,
      price: Math.round(all.reduce((s, g) => s + Number(g.price), 0) * 100) / 100,
    },
    truncated: all.length > items.length,
  }
})
