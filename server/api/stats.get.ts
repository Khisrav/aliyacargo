import { createError } from 'h3'
import { requireTelegramAuth } from '../utils/auth'
import { useSupabaseAdmin } from '../utils/supabase'

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
  count: number
  weight: number
  revenue: number
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
  const { data, error } = await supabase
    .from('goods')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows = data ?? []
  const now = new Date()
  const todayKey = dateKey(now)
  const yesterday = new Date(now)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const yesterdayKey = dateKey(yesterday)
  const weekStart = startOfWeek(now)
  const monthStart = startOfMonth(now)

  const totalCount = rows.length
  const totalWeight = rows.reduce((sum, r) => sum + Number(r.weight), 0)
  const totalRevenue = rows.reduce((sum, r) => sum + Number(r.price), 0)

  const paidRows = rows.filter(r => r.has_paid)
  const unpaidRows = rows.filter(r => !r.has_paid)

  const paidCount = paidRows.length
  const unpaidCount = unpaidRows.length
  const paidRevenue = paidRows.reduce((sum, r) => sum + Number(r.price), 0)
  const unpaidRevenue = unpaidRows.reduce((sum, r) => sum + Number(r.price), 0)
  const paidWeight = paidRows.reduce((sum, r) => sum + Number(r.weight), 0)
  const unpaidWeight = unpaidRows.reduce((sum, r) => sum + Number(r.weight), 0)

  const avgWeight = totalCount ? totalWeight / totalCount : 0
  const avgPrice = totalCount ? totalRevenue / totalCount : 0
  const avgPricePerKg = totalWeight ? totalRevenue / totalWeight : 0
  const paidRate = totalCount ? (paidCount / totalCount) * 100 : 0

  const weights = rows.map(r => Number(r.weight))
  const maxWeight = weights.length ? Math.max(...weights) : 0
  const minWeight = weights.length ? Math.min(...weights) : 0

  const today = emptyPeriod()
  const yesterdayStats = emptyPeriod()
  const week = emptyPeriod()
  const month = emptyPeriod()

  const days = 14
  const buckets: DayBucket[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i)
    buckets.push({ date: dateKey(d), count: 0, weight: 0, revenue: 0 })
  }
  const bucketByDate = new Map(buckets.map(b => [b.date, b]))

  const customers = new Map<string, TopCustomer>()

  for (const row of rows) {
    const weight = Number(row.weight)
    const price = Number(row.price)
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

    const name = String(row.name || '').trim() || 'Без имени'
    const existing = customers.get(name)
    if (existing) {
      existing.count += 1
      existing.weight += weight
      existing.revenue += price
    }
    else {
      customers.set(name, { name, count: 1, weight, revenue: price })
    }
  }

  const topCustomers = [...customers.values()]
    .sort((a, b) => b.revenue - a.revenue || b.count - a.count)
    .slice(0, 8)

  return {
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
    avgPricePerKg,
    paidRate,
    maxWeight,
    minWeight,
    today,
    yesterday: yesterdayStats,
    week,
    month,
    topCustomers,
    daily: buckets,
  }
})
