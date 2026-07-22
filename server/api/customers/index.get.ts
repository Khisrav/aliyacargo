import { createError, getQuery } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'
import { digitsOnly } from '#shared/utils/phone'

export interface CustomerListItem {
  id: number
  phone: string
  name: string
  created_at: string
  goodsCount: number
  totalWeight: number
  totalRevenue: number
  unpaidCount: number
  unpaidRevenue: number
  lastActivityAt: string | null
}

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)

  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const debt = typeof query.debt === 'string' ? query.debt : 'all'
  const activityFrom = typeof query.activityFrom === 'string' ? query.activityFrom : ''
  const activityTo = typeof query.activityTo === 'string' ? query.activityTo : ''
  const sort = typeof query.sort === 'string' ? query.sort : 'name'
  const minGoods = Number(query.minGoods || 0)

  const supabase = useSupabaseAdmin()

  let customerQuery = supabase
    .from('customers')
    .select('id, phone, name, created_at')
    .limit(1000)

  if (search) {
    const phoneDigits = digitsOnly(search)
    if (phoneDigits.length >= 3) {
      customerQuery = customerQuery.or(`name.ilike.%${search}%,phone.ilike.%${phoneDigits}%`)
    }
    else {
      customerQuery = customerQuery.ilike('name', `%${search}%`)
    }
  }

  const { data: customers, error: customersError } = await customerQuery

  if (customersError) {
    throw createError({ statusCode: 500, statusMessage: customersError.message })
  }

  const list = customers ?? []
  if (!list.length) {
    return [] as CustomerListItem[]
  }

  const ids = list.map(c => c.id)
  const { data: goods, error: goodsError } = await supabase
    .from('goods')
    .select('customer_id, weight, price, has_paid, created_at')
    .in('customer_id', ids)

  if (goodsError) {
    throw createError({ statusCode: 500, statusMessage: goodsError.message })
  }

  const statsByCustomer = new Map<number, {
    goodsCount: number
    totalWeight: number
    totalRevenue: number
    unpaidCount: number
    unpaidRevenue: number
    lastActivityAt: string | null
  }>()

  for (const row of goods ?? []) {
    const id = Number(row.customer_id)
    const createdAt = String(row.created_at)
    const current = statsByCustomer.get(id) ?? {
      goodsCount: 0,
      totalWeight: 0,
      totalRevenue: 0,
      unpaidCount: 0,
      unpaidRevenue: 0,
      lastActivityAt: null as string | null,
    }

    current.goodsCount += 1
    current.totalWeight += Number(row.weight)
    current.totalRevenue += Number(row.price)
    if (!row.has_paid) {
      current.unpaidCount += 1
      current.unpaidRevenue += Number(row.price)
    }
    if (!current.lastActivityAt || createdAt > current.lastActivityAt) {
      current.lastActivityAt = createdAt
    }

    statsByCustomer.set(id, current)
  }

  let result: CustomerListItem[] = list.map((customer) => {
    const stats = statsByCustomer.get(customer.id) ?? {
      goodsCount: 0,
      totalWeight: 0,
      totalRevenue: 0,
      unpaidCount: 0,
      unpaidRevenue: 0,
      lastActivityAt: null,
    }

    return {
      id: customer.id,
      phone: customer.phone,
      name: customer.name,
      created_at: customer.created_at,
      ...stats,
    }
  })

  if (debt === 'with_debt') {
    result = result.filter(c => c.unpaidCount > 0)
  }
  else if (debt === 'no_debt') {
    result = result.filter(c => c.unpaidCount === 0 && c.goodsCount > 0)
  }
  else if (debt === 'no_goods') {
    result = result.filter(c => c.goodsCount === 0)
  }

  if (Number.isFinite(minGoods) && minGoods > 0) {
    result = result.filter(c => c.goodsCount >= minGoods)
  }

  if (activityFrom) {
    const from = `${activityFrom}T00:00:00.000Z`
    result = result.filter(c => c.lastActivityAt && c.lastActivityAt >= from)
  }

  if (activityTo) {
    const to = `${activityTo}T23:59:59.999Z`
    result = result.filter(c => c.lastActivityAt && c.lastActivityAt <= to)
  }

  result.sort((a, b) => {
    switch (sort) {
      case 'debt':
        return b.unpaidRevenue - a.unpaidRevenue || b.goodsCount - a.goodsCount
      case 'revenue':
        return b.totalRevenue - a.totalRevenue || b.goodsCount - a.goodsCount
      case 'goods':
        return b.goodsCount - a.goodsCount || a.name.localeCompare(b.name, 'ru')
      case 'recent':
        return (b.lastActivityAt || '').localeCompare(a.lastActivityAt || '')
      case 'name':
      default:
        return a.name.localeCompare(b.name, 'ru')
    }
  })

  return result
})
