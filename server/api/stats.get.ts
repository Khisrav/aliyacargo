import { createError, getQuery } from 'h3'
import { requireTelegramAuth } from '../utils/auth'
import { GOODS_SELECT, mapGoodRow, useSupabaseAdmin } from '../utils/supabase'

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'

interface DayBucket {
  date: string
  count: number
  weight: number
  revenue: number
}

interface TopCustomer {
  id: number
  name: string
  phone: string
  count: number
  weight: number
  revenue: number
  unpaidCount: number
  unpaidRevenue: number
}

const PERIODS = new Set<Period>(['today', 'yesterday', 'week', 'month', 'all', 'custom'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_CHART_DAYS = 62

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

function startOfDay(d: Date) {
  const result = new Date(d)
  result.setUTCHours(0, 0, 0, 0)
  return result
}

function endOfDay(d: Date) {
  const result = new Date(d)
  result.setUTCHours(23, 59, 59, 999)
  return result
}

function startOfWeek(d: Date) {
  const result = startOfDay(d)
  const day = result.getUTCDay()
  const diff = day === 0 ? 6 : day - 1
  result.setUTCDate(result.getUTCDate() - diff)
  return result
}

function startOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

function parseDateParam(value: unknown, label: string): Date | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw createError({ statusCode: 400, statusMessage: `Invalid ${label}` })
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) {
    throw createError({ statusCode: 400, statusMessage: `Invalid ${label}` })
  }
  return parsed
}

function resolvePeriod(
  period: Period,
  dateFromRaw: unknown,
  dateToRaw: unknown,
): { from: Date | null, to: Date | null } {
  const now = new Date()

  if (period === 'custom') {
    const fromDate = parseDateParam(dateFromRaw, 'dateFrom')
    const toDate = parseDateParam(dateToRaw, 'dateTo')

    if (!fromDate && !toDate) {
      throw createError({ statusCode: 400, statusMessage: 'dateFrom or dateTo is required for custom period' })
    }

    const from = fromDate ? startOfDay(fromDate) : null
    const to = toDate ? endOfDay(toDate) : endOfDay(now)

    if (from && to && from > to) {
      throw createError({ statusCode: 400, statusMessage: 'dateFrom must be before dateTo' })
    }

    return { from, to }
  }

  switch (period) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) }
    case 'yesterday': {
      const day = startOfDay(now)
      day.setUTCDate(day.getUTCDate() - 1)
      return { from: day, to: endOfDay(day) }
    }
    case 'week':
      return { from: startOfWeek(now), to: endOfDay(now) }
    case 'month':
      return { from: startOfMonth(now), to: endOfDay(now) }
    case 'all':
    default:
      return { from: null, to: null }
  }
}

function buildDailyBuckets(from: Date, to: Date): DayBucket[] {
  const buckets: DayBucket[] = []
  let cursor = startOfDay(from)
  const end = startOfDay(to)

  const daySpan = Math.round((end.getTime() - cursor.getTime()) / 86_400_000) + 1
  if (daySpan > MAX_CHART_DAYS) {
    cursor = new Date(end)
    cursor.setUTCDate(cursor.getUTCDate() - (MAX_CHART_DAYS - 1))
  }

  while (cursor <= end) {
    buckets.push({ date: dateKey(cursor), count: 0, weight: 0, revenue: 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return buckets
}

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)

  const query = getQuery(event)
  const rawPeriod = typeof query.period === 'string' ? query.period : 'all'
  const period: Period = PERIODS.has(rawPeriod as Period) ? (rawPeriod as Period) : 'all'
  const { from, to } = resolvePeriod(period, query.dateFrom, query.dateTo)

  const supabase = useSupabaseAdmin()
  let goodsQuery = supabase
    .from('goods')
    .select(GOODS_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (from) {
    goodsQuery = goodsQuery.gte('created_at', from.toISOString())
  }
  if (to) {
    goodsQuery = goodsQuery.lte('created_at', to.toISOString())
  }

  const { data, error } = await goodsQuery

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows = (data ?? [])
    .filter((row: any) => !row.customers?.deleted_at)
    .map(mapGoodRow)

  const now = new Date()
  const chartFrom = from ?? (() => {
    const d = startOfDay(now)
    d.setUTCDate(d.getUTCDate() - 13)
    return d
  })()
  const chartTo = to ?? endOfDay(now)

  const buckets = buildDailyBuckets(chartFrom, chartTo)
  const bucketByDate = new Map(buckets.map(b => [b.date, b]))

  const totalCount = rows.length
  const totalWeight = rows.reduce((sum, r) => sum + r.weight, 0)
  const totalRevenue = rows.reduce((sum, r) => sum + r.price, 0)

  const paidRows = rows.filter(r => r.has_paid)
  const unpaidRows = rows.filter(r => !r.has_paid)

  const paidCount = paidRows.length
  const unpaidCount = unpaidRows.length
  const paidRevenue = paidRows.reduce((sum, r) => sum + r.price, 0)
  const unpaidRevenue = unpaidRows.reduce((sum, r) => sum + r.price, 0)
  const paidWeight = paidRows.reduce((sum, r) => sum + r.weight, 0)
  const unpaidWeight = unpaidRows.reduce((sum, r) => sum + r.weight, 0)

  const avgWeight = totalCount ? totalWeight / totalCount : 0
  const avgPrice = totalCount ? totalRevenue / totalCount : 0
  const avgPricePerKg = totalWeight ? totalRevenue / totalWeight : 0
  const paidRate = totalCount ? (paidCount / totalCount) * 100 : 0

  const weights = rows.map(r => r.weight)
  const maxWeight = weights.length ? Math.max(...weights) : 0
  const minWeight = weights.length ? Math.min(...weights) : 0

  const customers = new Map<string, TopCustomer>()
  const debtors = new Map<string, TopCustomer>()

  for (const row of rows) {
    const weight = row.weight
    const price = row.price
    const created = new Date(row.created_at)
    const key = dateKey(created)

    const bucket = bucketByDate.get(key)
    if (bucket) {
      bucket.count += 1
      bucket.weight += weight
      bucket.revenue += price
    }

    const customerKey = row.phone || String(row.customer_id)
    const existing = customers.get(customerKey)
    if (existing) {
      existing.count += 1
      existing.weight += weight
      existing.revenue += price
      if (!row.has_paid) {
        existing.unpaidCount += 1
        existing.unpaidRevenue += price
      }
    }
    else {
      customers.set(customerKey, {
        id: row.customer_id,
        name: row.name || 'Без имени',
        phone: row.phone,
        count: 1,
        weight,
        revenue: price,
        unpaidCount: row.has_paid ? 0 : 1,
        unpaidRevenue: row.has_paid ? 0 : price,
      })
    }

    if (!row.has_paid) {
      const debtor = debtors.get(customerKey)
      if (debtor) {
        debtor.count += 1
        debtor.weight += weight
        debtor.revenue += price
        debtor.unpaidCount += 1
        debtor.unpaidRevenue += price
      }
      else {
        debtors.set(customerKey, {
          id: row.customer_id,
          name: row.name || 'Без имени',
          phone: row.phone,
          count: 1,
          weight,
          revenue: price,
          unpaidCount: 1,
          unpaidRevenue: price,
        })
      }
    }
  }

  const topCustomers = [...customers.values()]
    .sort((a, b) => b.revenue - a.revenue || b.count - a.count)
    .slice(0, 8)

  const leftovers = [...debtors.values()]
    .sort((a, b) => b.unpaidRevenue - a.unpaidRevenue)
    .slice(0, 15)

  return {
    period,
    periodFrom: from ? dateKey(from) : null,
    periodTo: to ? dateKey(to) : null,
    totalCount,
    totalWeight,
    totalRevenue,
    customersCount: customers.size,
    customersWithDebt: debtors.size,
    paidCount,
    unpaidCount,
    paidRevenue,
    unpaidRevenue,
    paidWeight,
    unpaidWeight,
    avgWeight,
    avgPrice,
    avgPricePerKg,
    paidRate,
    maxWeight,
    minWeight,
    topCustomers,
    leftovers,
    daily: buckets,
  }
})
