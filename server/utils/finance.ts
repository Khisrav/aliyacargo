import type { FinanceRecord } from '#shared/types/domain'

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
