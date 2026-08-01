import { createError, getQuery } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { GOODS_SELECT, mapGoodRow, useSupabaseAdmin } from '../../utils/supabase'
import { dateKey, marginPerKg, resolvePeriod, STATS_PERIODS, type StatsPeriod } from '../../utils/period'
import { mapFinanceRow } from '../../utils/finance'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)

  const config = useRuntimeConfig()
  const pricePerKg = Number(config.pricePerKg) || 30
  const costPerKg = Number(config.costPerKg) || 25
  const margin = marginPerKg(pricePerKg, costPerKg)

  const query = getQuery(event)
  const rawPeriod = typeof query.period === 'string' ? query.period : 'month'
  const period: StatsPeriod = STATS_PERIODS.has(rawPeriod as StatsPeriod) ? (rawPeriod as StatsPeriod) : 'month'
  const { from, to } = resolvePeriod(period, query.dateFrom, query.dateTo)

  const supabase = useSupabaseAdmin()

  let goodsQuery = supabase
    .from('goods')
    .select(GOODS_SELECT)
    .is('deleted_at', null)
    .eq('has_paid', true)
    .limit(5000)

  let financeQuery = supabase
    .from('finance_records')
    .select('id, type, amount, note, created_by, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(2000)

  if (from) {
    const fromIso = from.toISOString()
    goodsQuery = goodsQuery.gte('created_at', fromIso)
    financeQuery = financeQuery.gte('created_at', fromIso)
  }
  if (to) {
    const toIso = to.toISOString()
    goodsQuery = goodsQuery.lte('created_at', toIso)
    financeQuery = financeQuery.lte('created_at', toIso)
  }

  const [{ data: goodsData, error: goodsError }, { data: financeData, error: financeError }] = await Promise.all([
    goodsQuery,
    financeQuery,
  ])

  if (goodsError) {
    throw createError({ statusCode: 500, statusMessage: goodsError.message })
  }
  if (financeError) {
    throw createError({ statusCode: 500, statusMessage: financeError.message })
  }

  const paidGoods = (goodsData ?? [])
    .filter((row: any) => !row.customers?.deleted_at)
    .map(mapGoodRow)

  const paidWeight = paidGoods.reduce((sum, r) => sum + r.weight, 0)
  // Paid goods = revenue/income
  const cargoRevenue = Math.round(paidGoods.reduce((sum, r) => sum + r.price, 0) * 100) / 100
  // Cost of those paid goods = expense
  const cargoCost = Math.round(paidWeight * costPerKg * 100) / 100
  const cargoMargin = Math.round((cargoRevenue - cargoCost) * 100) / 100

  const ledger = (financeData ?? []).map(row => mapFinanceRow(row as Record<string, any>))
  const incomes = ledger.filter(r => r.type === 'income')
  const expenses = ledger.filter(r => r.type === 'expense')
  const otherIncomeTotal = Math.round(incomes.reduce((s, r) => s + r.amount, 0) * 100) / 100
  const otherExpenseTotal = Math.round(expenses.reduce((s, r) => s + r.amount, 0) * 100) / 100

  const incomeTotal = Math.round((cargoRevenue + otherIncomeTotal) * 100) / 100
  const expenseTotal = Math.round((cargoCost + otherExpenseTotal) * 100) / 100
  const netProfit = Math.round((incomeTotal - expenseTotal) * 100) / 100

  return {
    period,
    periodFrom: from ? dateKey(from) : null,
    periodTo: to ? dateKey(to) : null,
    pricePerKg,
    costPerKg,
    marginPerKg: margin,
    paidCount: paidGoods.length,
    paidWeight,
    paidRevenue: cargoRevenue,
    cargoRevenue,
    cargoCost,
    cargoMargin,
    otherIncomeTotal,
    otherExpenseTotal,
    incomeTotal,
    expenseTotal,
    incomeCount: incomes.length,
    expenseCount: expenses.length,
    netProfit,
    recentIncomes: incomes.slice(0, 8),
    recentExpenses: expenses.slice(0, 8),
  }
})
