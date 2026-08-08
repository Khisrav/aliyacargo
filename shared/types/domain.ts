export type AcceptanceStatus = 'open' | 'closed'
export type FinanceType = 'income' | 'expense'

export interface Client {
  id: number
  name: string
  phone: string
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface Acceptance {
  id: number
  accepted_at: string
  total_weight: number
  paid_tjs: number
  cost_per_kg: number
  status: AcceptanceStatus
  closed_at: string | null
  waste_weight: number | null
  created_by: string | null
  created_at: string
  /** derived */
  sorted_weight?: number
  goods_count?: number
}

export interface Good {
  id: number
  acceptance_id: number
  client_id: number
  name: string
  weight: number
  price: number
  has_paid: boolean
  paid_at: string | null
  payment_accepted_by: string | null
  created_at: string
  updated_at: string
  /** joined */
  client_name: string
  phone: string
}

export interface FinanceRecord {
  id: number
  type: FinanceType
  amount: number
  note: string
  created_by: string | null
  created_at: string
}

export interface AcceptanceStats {
  id: number
  accepted_at: string
  status: AcceptanceStatus
  closed_at: string | null
  total_weight: number
  sorted_weight: number
  /** frozen at close; null while the batch is still open */
  waste_weight: number | null
  /** still to sort; only meaningful while the batch is open */
  unsorted_weight: number
  /** packages deleted after the batch closed, so the weights still balance */
  removed_weight: number
  /** share of the received weight that has been sorted into packages */
  sorting_rate: number
  goods_count: number
  paid_count: number
  unpaid_count: number
  clients_count: number
  total_revenue: number
  paid_revenue: number
  unpaid_revenue: number
  /** share of the batch's revenue clients have actually paid */
  payment_rate: number
  cost: number
  cost_per_kg: number
  /** profit once every client pays */
  margin: number
  /** profit banked so far */
  realized: number
}

export interface AcceptanceStatsClient {
  id: number
  name: string
  phone: string
  goods_count: number
  weight: number
  total: number
  paid: number
  unpaid: number
}

export interface AcceptanceStatsDetail extends AcceptanceStats {
  price_per_kg: number
  waste_rate: number
  paid_weight: number
  unpaid_weight: number
  first_payment_at: string | null
  last_payment_at: string | null
  clients: AcceptanceStatsClient[]
}

export interface ReportCollector {
  collector: string
  count: number
  amount: number
}

export interface ReportFinanceItem {
  type: FinanceType
  amount: number
  note: string
  created_by: string | null
  created_at: string
}

export interface DailyReport {
  id: number
  report_date: string
  /** goods sorted during the day */
  goods_count: number
  goods_weight: number
  goods_revenue: number
  goods_paid_count: number
  goods_paid_revenue: number
  /** of the day's goods, still unpaid at midnight */
  unpaid_count: number
  unpaid_weight: number
  unpaid_revenue: number
  /** cash collected during the day, including goods sorted earlier */
  payments_count: number
  payments_weight: number
  payments_revenue: number
  payments_by_collector: ReportCollector[]
  income_count: number
  income_total: number
  expense_count: number
  expense_total: number
  finance_items: ReportFinanceItem[]
  acceptances_count: number
  acceptance_weight: number
  acceptance_cost: number
  acceptances_closed: number
  waste_weight: number
  new_clients_count: number
  /** total outstanding debt across all clients at midnight */
  debt_count: number
  debt_weight: number
  debt_revenue: number
  debt_clients_count: number
  net_profit: number
  generated_at: string
}

export interface ClientListItem extends Client {
  goodsCount: number
  totalWeight: number
  totalRevenue: number
  unpaidCount: number
  unpaidRevenue: number
  unpaidWeight: number
  lastActivityAt: string | null
}
