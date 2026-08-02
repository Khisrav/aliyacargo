export interface Report {
  id: number
  report_date: string
  price_per_kg: number
  cost_per_kg: number
  goods_count: number
  total_weight: number
  paid_count: number
  paid_weight: number
  paid_revenue: number
  unpaid_count: number
  unpaid_weight: number
  unpaid_revenue: number
  other_income: number
  other_expense: number
  cargo_cost: number
  cargo_margin: number
  income_total: number
  expense_total: number
  net_profit: number
  note: string
  created_by: string | null
  created_at: string
}
