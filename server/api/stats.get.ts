import { createError, getQuery } from 'h3'
import { requireTelegramAuth } from '../utils/auth'
import { resolvePeriod, STATS_PERIODS, type StatsPeriod, dateKey } from '../utils/period'
import { useSupabaseAdmin } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)
  const query = getQuery(event)
  const periodRaw = typeof query.period === 'string' ? query.period : 'all'
  const period = (STATS_PERIODS.has(periodRaw as StatsPeriod) ? periodRaw : 'all') as StatsPeriod
  const { from, to } = resolvePeriod(period, query.dateFrom, query.dateTo)

  const supabase = useSupabaseAdmin()

  let goodsQuery = supabase
    .from('goods')
    .select('id, weight, price, has_paid, created_at, client_id, clients(id, name, phone)')
    .is('deleted_at', null)
    .limit(10000)

  if (from) goodsQuery = goodsQuery.gte('created_at', from.toISOString())
  if (to) goodsQuery = goodsQuery.lte('created_at', to.toISOString())

  let accQuery = supabase
    .from('acceptances')
    .select('id, total_weight, paid_tjs, cost_per_kg, status, waste_weight, accepted_at')
    .is('deleted_at', null)
    .limit(2000)

  if (from) accQuery = accQuery.gte('accepted_at', dateKey(from))
  if (to) accQuery = accQuery.lte('accepted_at', dateKey(to))

  let financeQuery = supabase
    .from('finance_records')
    .select('type, amount, created_at')
    .is('deleted_at', null)
    .limit(5000)

  if (from) financeQuery = financeQuery.gte('created_at', from.toISOString())
  if (to) financeQuery = financeQuery.lte('created_at', to.toISOString())

  const [goodsRes, accRes, finRes] = await Promise.all([goodsQuery, accQuery, financeQuery])

  if (goodsRes.error) throw createError({ statusCode: 500, statusMessage: goodsRes.error.message })
  if (accRes.error) throw createError({ statusCode: 500, statusMessage: accRes.error.message })
  if (finRes.error) throw createError({ statusCode: 500, statusMessage: finRes.error.message })

  const goods = goodsRes.data ?? []
  const acceptances = accRes.data ?? []
  const finance = finRes.data ?? []

  const unpaid = goods.filter(g => !g.has_paid)
  const paid = goods.filter(g => g.has_paid)

  const totalWeight = goods.reduce((s, g) => s + Number(g.weight), 0)
  const totalRevenue = goods.reduce((s, g) => s + Number(g.price), 0)
  const paidRevenue = paid.reduce((s, g) => s + Number(g.price), 0)
  const unpaidRevenue = unpaid.reduce((s, g) => s + Number(g.price), 0)
  const paidWeight = paid.reduce((s, g) => s + Number(g.weight), 0)
  const unpaidWeight = unpaid.reduce((s, g) => s + Number(g.weight), 0)

  const acceptanceCost = acceptances.reduce((s, a) => s + Number(a.paid_tjs), 0)
  const wasteWeight = acceptances.reduce((s, a) => s + Number(a.waste_weight ?? 0), 0)
  const acceptanceWeight = acceptances.reduce((s, a) => s + Number(a.total_weight), 0)

  const otherIncome = finance.filter(f => f.type === 'income').reduce((s, f) => s + Number(f.amount), 0)
  const otherExpense = finance.filter(f => f.type === 'expense').reduce((s, f) => s + Number(f.amount), 0)

  const net = (paidRevenue + otherIncome) - (acceptanceCost + otherExpense)

  const clientMap = new Map<number, {
    id: number
    name: string
    phone: string
    unpaidCount: number
    unpaidRevenue: number
    unpaidWeight: number
  }>()

  for (const g of unpaid) {
    const client = (g as any).clients ?? {}
    const id = Number(g.client_id)
    const cur = clientMap.get(id) ?? {
      id,
      name: String(client.name ?? ''),
      phone: String(client.phone ?? ''),
      unpaidCount: 0,
      unpaidRevenue: 0,
      unpaidWeight: 0,
    }
    cur.unpaidCount += 1
    cur.unpaidRevenue += Number(g.price)
    cur.unpaidWeight += Number(g.weight)
    clientMap.set(id, cur)
  }

  const leftovers = [...clientMap.values()]
    .sort((a, b) => b.unpaidRevenue - a.unpaidRevenue)
    .slice(0, 15)
    .map(c => ({
      ...c,
      unpaidRevenue: Math.round(c.unpaidRevenue * 100) / 100,
      unpaidWeight: Math.round(c.unpaidWeight * 1000) / 1000,
    }))

  const dailyMap = new Map<string, { date: string, count: number, weight: number, revenue: number, paidRevenue: number }>()
  for (const g of goods) {
    const date = String(g.created_at).slice(0, 10)
    const cur = dailyMap.get(date) ?? { date, count: 0, weight: 0, revenue: 0, paidRevenue: 0 }
    cur.count += 1
    cur.weight += Number(g.weight)
    cur.revenue += Number(g.price)
    if (g.has_paid) cur.paidRevenue += Number(g.price)
    dailyMap.set(date, cur)
  }

  const daily = [...dailyMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({
      date: d.date,
      count: d.count,
      weight: Math.round(d.weight * 1000) / 1000,
      revenue: Math.round(d.revenue * 100) / 100,
      paidRevenue: Math.round(d.paidRevenue * 100) / 100,
    }))

  const clientIds = new Set(goods.map(g => Number(g.client_id)))

  return {
    period,
    periodFrom: from ? dateKey(from) : null,
    periodTo: to ? dateKey(to) : null,
    totalCount: goods.length,
    totalWeight: Math.round(totalWeight * 1000) / 1000,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    clientsCount: clientIds.size,
    clientsWithDebt: leftovers.length,
    paidCount: paid.length,
    unpaidCount: unpaid.length,
    paidRevenue: Math.round(paidRevenue * 100) / 100,
    unpaidRevenue: Math.round(unpaidRevenue * 100) / 100,
    paidWeight: Math.round(paidWeight * 1000) / 1000,
    unpaidWeight: Math.round(unpaidWeight * 1000) / 1000,
    paidRate: goods.length ? Math.round((paid.length / goods.length) * 1000) / 10 : 0,
    acceptanceCount: acceptances.length,
    acceptanceWeight: Math.round(acceptanceWeight * 1000) / 1000,
    acceptanceCost: Math.round(acceptanceCost * 100) / 100,
    wasteWeight: Math.round(wasteWeight * 1000) / 1000,
    otherIncome: Math.round(otherIncome * 100) / 100,
    otherExpense: Math.round(otherExpense * 100) / 100,
    net: Math.round(net * 100) / 100,
    leftovers,
    daily,
  }
})
