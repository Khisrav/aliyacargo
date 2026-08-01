import { createError } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'
import { daysLeftInTrash, purgeExpiredTrash, TRASH_RETENTION_DAYS } from '../../utils/trash'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)

  const supabase = useSupabaseAdmin()
  await purgeExpiredTrash(supabase)

  const [
    { data: goods, error: goodsError },
    { data: customers, error: customersError },
    { data: finance, error: financeError },
  ] = await Promise.all([
    supabase
      .from('goods')
      .select(`
        id,
        customer_id,
        weight,
        price,
        has_paid,
        created_at,
        deleted_at,
        customers ( id, phone, name, deleted_at )
      `)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(500),
    supabase
      .from('customers')
      .select('id, phone, name, created_at, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(500),
    supabase
      .from('finance_records')
      .select('id, type, amount, note, created_at, deleted_at, created_by')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(500),
  ])

  if (goodsError) {
    throw createError({ statusCode: 500, statusMessage: goodsError.message })
  }

  if (customersError) {
    throw createError({ statusCode: 500, statusMessage: customersError.message })
  }

  if (financeError) {
    throw createError({ statusCode: 500, statusMessage: financeError.message })
  }

  return {
    retentionDays: TRASH_RETENTION_DAYS,
    goods: (goods ?? []).map((row: any) => {
      const customer = row.customers ?? {}
      return {
        id: row.id,
        type: 'good' as const,
        customer_id: row.customer_id,
        name: customer.name ?? '',
        phone: customer.phone ?? '',
        weight: Number(row.weight),
        price: Number(row.price),
        has_paid: Boolean(row.has_paid),
        created_at: row.created_at,
        deleted_at: row.deleted_at,
        daysLeft: daysLeftInTrash(row.deleted_at),
      }
    }),
    customers: (customers ?? []).map(row => ({
      id: row.id,
      type: 'customer' as const,
      name: row.name,
      phone: row.phone,
      created_at: row.created_at,
      deleted_at: row.deleted_at,
      daysLeft: daysLeftInTrash(row.deleted_at),
    })),
    finance: (finance ?? []).map(row => ({
      id: row.id,
      type: 'finance' as const,
      recordType: row.type === 'income' ? 'income' as const : 'expense' as const,
      amount: Number(row.amount),
      note: String(row.note ?? ''),
      created_by: row.created_by ? String(row.created_by) : null,
      created_at: row.created_at,
      deleted_at: row.deleted_at,
      daysLeft: daysLeftInTrash(row.deleted_at),
    })),
  }
})
