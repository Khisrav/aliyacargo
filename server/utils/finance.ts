export type FinanceType = 'income' | 'expense'

export interface FinanceRecord {
  id: number
  type: FinanceType
  amount: number
  note: string
  created_by: string | null
  created_at: string
}

export function mapFinanceRow(row: Record<string, any>): FinanceRecord {
  return {
    id: Number(row.id),
    type: row.type === 'income' ? 'income' : 'expense',
    amount: Number(row.amount),
    note: String(row.note ?? ''),
    created_by: row.created_by ? String(row.created_by) : null,
    created_at: String(row.created_at),
  }
}
