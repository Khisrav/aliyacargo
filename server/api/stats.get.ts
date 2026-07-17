import { createError } from 'h3'
import { requireTelegramAuth } from '../utils/auth'
import { useSupabaseAdmin } from '../utils/supabase'

interface DayBucket {
  date: string
  count: number
  weight: number
  revenue: number
}

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)

  const supabase = useSupabaseAdmin()
  const { data, error } = await supabase
    .from('goods')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2000)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows = data ?? []

  const totalCount = rows.length
  const totalWeight = rows.reduce((sum, r) => sum + Number(r.weight), 0)
  const totalRevenue = rows.reduce((sum, r) => sum + Number(r.price), 0)

  const paidRows = rows.filter(r => r.has_paid)
  const unpaidRows = rows.filter(r => !r.has_paid)

  const paidCount = paidRows.length
  const unpaidCount = unpaidRows.length
  const paidRevenue = paidRows.reduce((sum, r) => sum + Number(r.price), 0)
  const unpaidRevenue = unpaidRows.reduce((sum, r) => sum + Number(r.price), 0)

  const days = 14
  const buckets: DayBucket[] = []
  const now = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    buckets.push({ date: key, count: 0, weight: 0, revenue: 0 })
  }

  const bucketByDate = new Map(buckets.map(b => [b.date, b]))

  for (const row of rows) {
    const key = String(row.created_at).slice(0, 10)
    const bucket = bucketByDate.get(key)
    if (bucket) {
      bucket.count += 1
      bucket.weight += Number(row.weight)
      bucket.revenue += Number(row.price)
    }
  }

  return {
    totalCount,
    totalWeight,
    totalRevenue,
    paidCount,
    unpaidCount,
    paidRevenue,
    unpaidRevenue,
    daily: buckets,
  }
})
