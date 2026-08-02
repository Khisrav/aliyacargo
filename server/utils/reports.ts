import type { Report } from '#shared/types/report'

export type ReportDraft = Omit<Report, 'id' | 'created_by' | 'created_at'>

export interface ReportInput {
  report_date?: string
  price_per_kg?: number | string
  cost_per_kg?: number | string
  goods_count?: number | string
  total_weight?: number | string
  paid_count?: number | string
  paid_weight?: number | string
  paid_revenue?: number | string
  unpaid_count?: number | string
  unpaid_weight?: number | string
  unpaid_revenue?: number | string
  other_income?: number | string
  other_expense?: number | string
  note?: string
}

function roundMoney(n: number) {
  return Math.round(n * 100) / 100
}

function roundWeight(n: number) {
  return Math.round(n * 1000) / 1000
}

function nonNegNumber(value: unknown, fallback = 0) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return fallback
  return n
}

function nonNegInt(value: unknown, fallback = 0) {
  return Math.round(nonNegNumber(value, fallback))
}

export function deriveReportTotals(input: {
  total_weight: number
  paid_revenue: number
  other_income: number
  other_expense: number
  cost_per_kg: number
}) {
  const cargo_cost = roundMoney(input.total_weight * input.cost_per_kg)
  const cargo_margin = roundMoney(input.paid_revenue - cargo_cost)
  const income_total = roundMoney(input.paid_revenue + input.other_income)
  const expense_total = roundMoney(cargo_cost + input.other_expense)
  const net_profit = roundMoney(income_total - expense_total)
  return { cargo_cost, cargo_margin, income_total, expense_total, net_profit }
}

export function buildReportSnapshot(input: ReportInput, fallbackDate: string): ReportDraft {
  const price_per_kg = roundMoney(nonNegNumber(input.price_per_kg))
  const cost_per_kg = roundMoney(nonNegNumber(input.cost_per_kg))
  const total_weight = roundWeight(nonNegNumber(input.total_weight))
  const paid_revenue = roundMoney(nonNegNumber(input.paid_revenue))
  const other_income = roundMoney(nonNegNumber(input.other_income))
  const other_expense = roundMoney(nonNegNumber(input.other_expense))
  const derived = deriveReportTotals({
    total_weight,
    paid_revenue,
    other_income,
    other_expense,
    cost_per_kg,
  })

  return {
    report_date: typeof input.report_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.report_date)
      ? input.report_date
      : fallbackDate,
    price_per_kg,
    cost_per_kg,
    goods_count: nonNegInt(input.goods_count),
    total_weight,
    paid_count: nonNegInt(input.paid_count),
    paid_weight: roundWeight(nonNegNumber(input.paid_weight)),
    paid_revenue,
    unpaid_count: nonNegInt(input.unpaid_count),
    unpaid_weight: roundWeight(nonNegNumber(input.unpaid_weight)),
    unpaid_revenue: roundMoney(nonNegNumber(input.unpaid_revenue)),
    other_income,
    other_expense,
    ...derived,
    note: typeof input.note === 'string' ? input.note.trim() : '',
  }
}

export function mapReportRow(row: Record<string, any>): Report {
  return {
    id: Number(row.id),
    report_date: String(row.report_date).slice(0, 10),
    price_per_kg: Number(row.price_per_kg),
    cost_per_kg: Number(row.cost_per_kg),
    goods_count: Number(row.goods_count),
    total_weight: Number(row.total_weight),
    paid_count: Number(row.paid_count),
    paid_weight: Number(row.paid_weight),
    paid_revenue: Number(row.paid_revenue),
    unpaid_count: Number(row.unpaid_count),
    unpaid_weight: Number(row.unpaid_weight),
    unpaid_revenue: Number(row.unpaid_revenue),
    other_income: Number(row.other_income),
    other_expense: Number(row.other_expense),
    cargo_cost: Number(row.cargo_cost),
    cargo_margin: Number(row.cargo_margin),
    income_total: Number(row.income_total),
    expense_total: Number(row.expense_total),
    net_profit: Number(row.net_profit),
    note: String(row.note ?? ''),
    created_by: row.created_by ? String(row.created_by) : null,
    created_at: String(row.created_at),
  }
}

export const REPORT_SELECT = `
  id,
  report_date,
  price_per_kg,
  cost_per_kg,
  goods_count,
  total_weight,
  paid_count,
  paid_weight,
  paid_revenue,
  unpaid_count,
  unpaid_weight,
  unpaid_revenue,
  other_income,
  other_expense,
  cargo_cost,
  cargo_margin,
  income_total,
  expense_total,
  net_profit,
  note,
  created_by,
  created_at
`.replace(/\s+/g, ' ').trim()
