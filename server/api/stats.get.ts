import { getQuery } from 'h3'
import { requireTelegramAuth } from '../utils/auth'
import { money, weight } from '../utils/acceptanceStats'
import { fetchAllPages } from '../utils/pagination'
import { resolvePeriod, STATS_PERIODS, type StatsPeriod } from '../utils/period'
import { businessDateKey } from '../utils/reports'
import { useSupabaseAdmin } from '../utils/supabase'

/**
 * Two independent views:
 * - debt: what clients owe right now, all time; the period does not apply.
 * - period money: cash basis, the same formula as generate_daily_report.net_profit,
 *   so a single day here matches that day's report.
 */
export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)
  const query = getQuery(event)
  const periodRaw = typeof query.period === 'string' ? query.period : 'all'
  const period = (STATS_PERIODS.has(periodRaw as StatsPeriod) ? periodRaw : 'all') as StatsPeriod
  const { from, to, fromKey, toKey } = resolvePeriod(period, query.dateFrom, query.dateTo)

  const supabase = useSupabaseAdmin()

  const [unpaid, payments, acceptances, finance] = await Promise.all([
    fetchAllPages<{ id: number, client_id: number, weight: number, price: number, clients: any }>((rFrom, rTo) =>
      supabase
        .from('goods')
        .select('id, client_id, weight, price, clients(id, name, phone)')
        .is('deleted_at', null)
        .eq('has_paid', false)
        .order('id', { ascending: true })
        .range(rFrom, rTo),
    ),
    fetchAllPages<{ id: number, price: number, paid_at: string }>((rFrom, rTo) => {
      let q = supabase
        .from('goods')
        .select('id, price, paid_at')
        .is('deleted_at', null)
        .eq('has_paid', true)
        .not('paid_at', 'is', null)
      if (from) q = q.gte('paid_at', from.toISOString())
      if (to) q = q.lt('paid_at', to.toISOString())
      return q.order('id', { ascending: true }).range(rFrom, rTo)
    }),
    fetchAllPages<{ id: number, total_weight: number, paid_tjs: number }>((rFrom, rTo) => {
      let q = supabase
        .from('acceptances')
        .select('id, total_weight, paid_tjs')
        .is('deleted_at', null)
      if (fromKey) q = q.gte('accepted_at', fromKey)
      if (toKey) q = q.lte('accepted_at', toKey)
      return q.order('id', { ascending: true }).range(rFrom, rTo)
    }),
    fetchAllPages<{ id: number, type: string, amount: number }>((rFrom, rTo) => {
      let q = supabase
        .from('finance_records')
        .select('id, type, amount')
        .is('deleted_at', null)
      if (from) q = q.gte('created_at', from.toISOString())
      if (to) q = q.lt('created_at', to.toISOString())
      return q.order('id', { ascending: true }).range(rFrom, rTo)
    }),
  ])

  const debtors = new Map<number, {
    id: number
    name: string
    phone: string
    count: number
    weight: number
    amount: number
  }>()

  for (const g of unpaid) {
    const id = Number(g.client_id)
    const client = g.clients ?? {}
    const cur = debtors.get(id) ?? {
      id,
      name: String(client.name ?? ''),
      phone: String(client.phone ?? ''),
      count: 0,
      weight: 0,
      amount: 0,
    }
    cur.count += 1
    cur.weight += Number(g.weight)
    cur.amount += Number(g.price)
    debtors.set(id, cur)
  }

  const collected = payments.reduce((s, g) => s + Number(g.price), 0)
  const purchases = acceptances.reduce((s, a) => s + Number(a.paid_tjs), 0)
  const otherIncome = finance.filter(f => f.type === 'income').reduce((s, f) => s + Number(f.amount), 0)
  const otherExpense = finance.filter(f => f.type === 'expense').reduce((s, f) => s + Number(f.amount), 0)

  const dailyMap = new Map<string, number>()
  for (const g of payments) {
    const date = businessDateKey(new Date(g.paid_at))
    dailyMap.set(date, (dailyMap.get(date) ?? 0) + Number(g.price))
  }

  return {
    period,
    periodFrom: fromKey,
    periodTo: toKey,
    debt: {
      count: unpaid.length,
      weight: weight(unpaid.reduce((s, g) => s + Number(g.weight), 0)),
      amount: money(unpaid.reduce((s, g) => s + Number(g.price), 0)),
      clients: debtors.size,
      top: [...debtors.values()]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 15)
        .map(c => ({ ...c, weight: weight(c.weight), amount: money(c.amount) })),
    },
    collected: { count: payments.length, amount: money(collected) },
    purchases: {
      count: acceptances.length,
      weight: weight(acceptances.reduce((s, a) => s + Number(a.total_weight), 0)),
      amount: money(purchases),
    },
    otherIncome: money(otherIncome),
    otherExpense: money(otherExpense),
    net: money(collected + otherIncome - purchases - otherExpense),
    daily: [...dailyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount: money(amount) })),
  }
})
