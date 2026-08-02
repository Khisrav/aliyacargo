import { createError } from 'h3'
import { GOODS_SELECT, mapGoodRow, useSupabaseAdmin } from '../utils/supabase'
import { dateKey, endOfDay, startOfDay } from '../utils/period'
import { buildReportSnapshot, type ReportDraft } from '../utils/reports'
import { mapFinanceRow } from '../utils/finance'

function roundMoney(n: number) {
  return Math.round(n * 100) / 100
}

function roundWeight(n: number) {
  return Math.round(n * 1000) / 1000
}

/** Prefill today's report draft from live goods + finance data. */
export async function buildTodayReportDraft(): Promise<{
  draft: ReportDraft
  todayExists: boolean
  existingId: number | null
}> {
  const config = useRuntimeConfig()
  const pricePerKg = Number(config.pricePerKg) || 30
  const costPerKg = Number(config.costPerKg) || 25

  const now = new Date()
  const from = startOfDay(now)
  const to = endOfDay(now)
  const reportDate = dateKey(from)
  const fromIso = from.toISOString()
  const toIso = to.toISOString()

  const supabase = useSupabaseAdmin()

  const [
    { data: goodsData, error: goodsError },
    { data: financeData, error: financeError },
    { data: existing, error: existingError },
  ] = await Promise.all([
    supabase
      .from('goods')
      .select(GOODS_SELECT)
      .is('deleted_at', null)
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .limit(5000),
    supabase
      .from('finance_records')
      .select('id, type, amount, note, created_by, created_at')
      .is('deleted_at', null)
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .limit(2000),
    supabase
      .from('reports')
      .select('id')
      .eq('report_date', reportDate)
      .maybeSingle(),
  ])

  if (goodsError) {
    throw createError({ statusCode: 500, statusMessage: goodsError.message })
  }
  if (financeError) {
    throw createError({ statusCode: 500, statusMessage: financeError.message })
  }
  if (existingError) {
    throw createError({ statusCode: 500, statusMessage: existingError.message })
  }

  const goods = (goodsData ?? [])
    .filter((row: any) => !row.customers?.deleted_at)
    .map(mapGoodRow)

  const paid = goods.filter(g => g.has_paid)
  const unpaid = goods.filter(g => !g.has_paid)

  const totalWeight = roundWeight(goods.reduce((s, g) => s + g.weight, 0))
  const paidWeight = roundWeight(paid.reduce((s, g) => s + g.weight, 0))
  const unpaidWeight = roundWeight(unpaid.reduce((s, g) => s + g.weight, 0))
  const paidRevenue = roundMoney(paid.reduce((s, g) => s + g.price, 0))
  const unpaidRevenue = roundMoney(unpaid.reduce((s, g) => s + g.price, 0))

  const ledger = (financeData ?? []).map(row => mapFinanceRow(row as Record<string, any>))
  const otherIncome = roundMoney(ledger.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0))
  const otherExpense = roundMoney(ledger.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0))

  const draft = buildReportSnapshot({
    report_date: reportDate,
    price_per_kg: pricePerKg,
    cost_per_kg: costPerKg,
    goods_count: goods.length,
    total_weight: totalWeight,
    paid_count: paid.length,
    paid_weight: paidWeight,
    paid_revenue: paidRevenue,
    unpaid_count: unpaid.length,
    unpaid_weight: unpaidWeight,
    unpaid_revenue: unpaidRevenue,
    other_income: otherIncome,
    other_expense: otherExpense,
    note: '',
  }, reportDate)

  return {
    draft,
    todayExists: !!existing,
    existingId: existing ? Number(existing.id) : null,
  }
}
