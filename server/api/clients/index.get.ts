import { createError, getQuery } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'
import type { ClientListItem } from '#shared/types/domain'
import { normalizePhone } from '#shared/utils/phone'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)
  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const debt = typeof query.debt === 'string' ? query.debt : 'all'

  const supabase = useSupabaseAdmin()
  let clientsQuery = supabase
    .from('clients')
    .select('id, name, phone, created_at, updated_at, deleted_at')
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(2000)

  if (search) {
    const digits = normalizePhone(search)
    clientsQuery = clientsQuery.or(
      digits
        ? `name.ilike.%${search}%,phone.ilike.%${digits}%`
        : `name.ilike.%${search}%`,
    )
  }

  const { data: clients, error } = await clientsQuery
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const clientIds = (clients ?? []).map(c => c.id)
  if (!clientIds.length) return []

  const { data: goods, error: goodsError } = await supabase
    .from('goods')
    .select('client_id, weight, price, has_paid, created_at')
    .in('client_id', clientIds)
    .is('deleted_at', null)

  if (goodsError) {
    throw createError({ statusCode: 500, statusMessage: goodsError.message })
  }

  const stats = new Map<number, {
    goodsCount: number
    totalWeight: number
    totalRevenue: number
    unpaidCount: number
    unpaidRevenue: number
    unpaidWeight: number
    lastActivityAt: string | null
  }>()

  for (const g of goods ?? []) {
    const id = Number(g.client_id)
    const cur = stats.get(id) ?? {
      goodsCount: 0,
      totalWeight: 0,
      totalRevenue: 0,
      unpaidCount: 0,
      unpaidRevenue: 0,
      unpaidWeight: 0,
      lastActivityAt: null as string | null,
    }
    cur.goodsCount += 1
    cur.totalWeight += Number(g.weight)
    cur.totalRevenue += Number(g.price)
    if (!g.has_paid) {
      cur.unpaidCount += 1
      cur.unpaidRevenue += Number(g.price)
      cur.unpaidWeight += Number(g.weight)
    }
    if (!cur.lastActivityAt || g.created_at > cur.lastActivityAt) {
      cur.lastActivityAt = g.created_at
    }
    stats.set(id, cur)
  }

  let items: ClientListItem[] = (clients ?? []).map((c) => {
    const s = stats.get(Number(c.id))
    return {
      id: Number(c.id),
      name: String(c.name),
      phone: String(c.phone),
      created_at: String(c.created_at),
      updated_at: String(c.updated_at),
      deleted_at: c.deleted_at,
      goodsCount: s?.goodsCount ?? 0,
      totalWeight: Math.round((s?.totalWeight ?? 0) * 1000) / 1000,
      totalRevenue: Math.round((s?.totalRevenue ?? 0) * 100) / 100,
      unpaidCount: s?.unpaidCount ?? 0,
      unpaidRevenue: Math.round((s?.unpaidRevenue ?? 0) * 100) / 100,
      unpaidWeight: Math.round((s?.unpaidWeight ?? 0) * 1000) / 1000,
      lastActivityAt: s?.lastActivityAt ?? null,
    }
  })

  if (debt === 'with_debt') {
    items = items.filter(c => c.unpaidCount > 0)
  }
  else if (debt === 'no_debt') {
    items = items.filter(c => c.goodsCount > 0 && c.unpaidCount === 0)
  }

  items.sort((a, b) => {
    if (debt === 'with_debt') return b.unpaidRevenue - a.unpaidRevenue
    return a.name.localeCompare(b.name, 'ru')
  })

  return items
})
