import { createError, getQuery } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'
import type { ClientListItem } from '#shared/types/domain'
import { normalizePhone } from '#shared/utils/phone'

const PAGE_SIZE = 1000
const MAX_PAGES = 100
const CLIENT_ID_BATCH = 150

type PageResult<T> = PromiseLike<{ data: T[] | null, error: { message: string } | null }>

async function fetchAllPages<T extends { id?: number | string }>(load: (from: number, to: number) => PageResult<T>) {
  const rows: T[] = []
  let previousFirstId: number | null = null

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await load(from, from + PAGE_SIZE - 1)
    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    const batch = data ?? []
    if (!batch.length) break

    const firstId = Number(batch[0]?.id)
    if (previousFirstId != null && firstId === previousFirstId) break
    if (Number.isFinite(firstId)) previousFirstId = firstId

    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }

  return rows
}

async function fetchGoodsForClients(
  supabase: ReturnType<typeof useSupabaseAdmin>,
  clientIds: number[],
) {
  const goods: Array<{
    client_id: number
    weight: number
    price: number
    has_paid: boolean
    created_at: string
  }> = []

  for (let offset = 0; offset < clientIds.length; offset += CLIENT_ID_BATCH) {
    const ids = clientIds.slice(offset, offset + CLIENT_ID_BATCH)
    const page = await fetchAllPages((from, to) =>
      supabase
        .from('goods')
        .select('id, client_id, weight, price, has_paid, created_at')
        .in('client_id', ids)
        .is('deleted_at', null)
        .order('id', { ascending: true })
        .range(from, to),
    )
    goods.push(...page)
  }

  return goods
}

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)
  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const debt = typeof query.debt === 'string' ? query.debt : 'all'

  const supabase = useSupabaseAdmin()
  const clients = await fetchAllPages<{
    id: number
    name: string
    phone: string
    created_at: string
    updated_at: string
    deleted_at: string | null
  }>((from, to) => {
    let clientsQuery = supabase
      .from('clients')
      .select('id, name, phone, created_at, updated_at, deleted_at')
      .is('deleted_at', null)

    if (search) {
      const digits = normalizePhone(search)
      clientsQuery = clientsQuery.or(
        digits
          ? `name.ilike.%${search}%,phone.ilike.%${digits}%`
          : `name.ilike.%${search}%`,
      )
    }

    return clientsQuery.order('id', { ascending: true }).range(from, to)
  })

  const clientIds = clients.map(c => Number(c.id))
  if (!clientIds.length) return []

  const goods = await fetchGoodsForClients(supabase, clientIds)

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
