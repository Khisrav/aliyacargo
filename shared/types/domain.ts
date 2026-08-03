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

export interface ClientListItem extends Client {
  goodsCount: number
  totalWeight: number
  totalRevenue: number
  unpaidCount: number
  unpaidRevenue: number
  unpaidWeight: number
  lastActivityAt: string | null
}
