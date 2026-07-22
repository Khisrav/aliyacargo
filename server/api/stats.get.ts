import { createError } from 'h3'
import { requireTelegramAuth } from '../utils/auth'
import { GOODS_SELECT, mapGoodRow, useSupabaseAdmin } from '../utils/supabase'

interface DayBucket {
  date: string
  count: number
  weight: number
  revenue: number
}

interface PeriodStats {
  count: number
  weight: number
  revenue: number
}

interface TopCustomer {
  name: string
  phone: string
  count: number
  weight: number
  revenue: number
  unpaidCount: number
  unpaidRevenue: number
}

function emptyPeriod(): PeriodStats {
  return { count: 0, weight: 0, revenue: 0 }
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

function startOfWeek(d: Date) {
  const result = new Date(d)
  const day = result.getUTCDay()
  const diff = day === 0 ? 6 : day - 1
  result.setUTCDate(result.getUTCDate() - diff)
  result.setUTCHours(0, 0, 0, 0)
  return result
}

function startOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

function accumulate(period: PeriodStats, weight: number, price: number) {
  period.count += 1
  period.weight += weight
  period.revenue += price
}

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)

  const supabase = useSupabaseAdmin()
  const [{ data, error }, customersRes] = await Promise.all([
    supabase
      .from('goods')
      .select(GOODS_SELECT)
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true }),
  ])

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (customersRes.error) {
    throw createError({ statusCode: 500, statusMessage: customersRes.error.message })
  }

  const rows = (data ?? []).map(mapGoodRow)
  const now = new Date()
  const todayKey = dateKey(now)
  const yesterday = new Date(now)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const yesterdayKey = dateKey(yesterday)
  const weekStart = startOfWeek(now)
  const monthStart = startOfMonth(now)

  const totalCount = rows.length
  const totalWeight = rows.reduce((sum, r) => sum + r.weight, 0)
  const totalRevenue = rows.reduce((sum, r) => sum + r.price, 0)
  const customersCount = customersRes.count ?? 0

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

  const today = emptyPeriod()
  const yesterdayStats = emptyPeriod()
  const week = emptyPeriod()
  const month = emptyPeriod()

  const days = 7
  const buckets: DayBucket[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i)
    buckets.push({ date: dateKey(d), count: 0, weight: 0, revenue: 0 })
  }
  const bucketByDate = new Map(buckets.map(b => [b.date, b]))

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

    if (key === todayKey) accumulate(today, weight, price)
    if (key === yesterdayKey) accumulate(yesterdayStats, weight, price)
    if (created >= weekStart) accumulate(week, weight, price)
    if (created >= monthStart) accumulate(month, weight, price)

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

  const customersWithDebt = debtors.size

  return {
    totalCount,
    totalWeight,
    totalRevenue,
    customersCount,
    customersWithDebt,
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
    today,
    yesterday: yesterdayStats,
    week,
    month,
    topCustomers,
    leftovers,
    daily: buckets,
  }
})
