import { createError } from 'h3'
import type { DailyReport, ReportCollector, ReportFinanceItem } from '#shared/types/domain'

/** The business day is the local calendar day, not the UTC one. */
export const BUSINESS_TZ = 'Asia/Dushanbe'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// en-CA renders as YYYY-MM-DD, which matches the `date` columns.
const businessDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function businessDateKey(date: Date = new Date()) {
  return businessDateFormatter.format(date)
}

export function parseReportDate(value: unknown, label = 'date'): string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw createError({ statusCode: 400, statusMessage: `Некорректная дата (${label})` })
  }
  return value
}

function mapCollectors(value: unknown): ReportCollector[] {
  if (!Array.isArray(value)) return []
  return value.map(item => ({
    collector: String(item?.collector ?? '—'),
    count: Number(item?.count ?? 0),
    amount: Number(item?.amount ?? 0),
  }))
}

function mapFinanceItems(value: unknown): ReportFinanceItem[] {
  if (!Array.isArray(value)) return []
  return value.map(item => ({
    type: item?.type === 'income' ? 'income' : 'expense',
    amount: Number(item?.amount ?? 0),
    note: String(item?.note ?? ''),
    created_by: item?.created_by ? String(item.created_by) : null,
    created_at: String(item?.created_at ?? ''),
  }))
}

export function mapReportRow(row: Record<string, any>): DailyReport {
  return {
    id: Number(row.id),
    report_date: String(row.report_date),
    goods_count: Number(row.goods_count ?? 0),
    goods_weight: Number(row.goods_weight ?? 0),
    goods_revenue: Number(row.goods_revenue ?? 0),
    goods_paid_count: Number(row.goods_paid_count ?? 0),
    goods_paid_revenue: Number(row.goods_paid_revenue ?? 0),
    unpaid_count: Number(row.unpaid_count ?? 0),
    unpaid_weight: Number(row.unpaid_weight ?? 0),
    unpaid_revenue: Number(row.unpaid_revenue ?? 0),
    payments_count: Number(row.payments_count ?? 0),
    payments_weight: Number(row.payments_weight ?? 0),
    payments_revenue: Number(row.payments_revenue ?? 0),
    payments_by_collector: mapCollectors(row.payments_by_collector),
    income_count: Number(row.income_count ?? 0),
    income_total: Number(row.income_total ?? 0),
    expense_count: Number(row.expense_count ?? 0),
    expense_total: Number(row.expense_total ?? 0),
    finance_items: mapFinanceItems(row.finance_items),
    acceptances_count: Number(row.acceptances_count ?? 0),
    acceptance_weight: Number(row.acceptance_weight ?? 0),
    acceptance_cost: Number(row.acceptance_cost ?? 0),
    acceptances_closed: Number(row.acceptances_closed ?? 0),
    waste_weight: Number(row.waste_weight ?? 0),
    new_clients_count: Number(row.new_clients_count ?? 0),
    debt_count: Number(row.debt_count ?? 0),
    debt_weight: Number(row.debt_weight ?? 0),
    debt_revenue: Number(row.debt_revenue ?? 0),
    debt_clients_count: Number(row.debt_clients_count ?? 0),
    net_profit: Number(row.net_profit ?? 0),
    generated_at: String(row.generated_at),
  }
}
