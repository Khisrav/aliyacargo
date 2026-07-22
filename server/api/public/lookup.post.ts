import { createError, readBody } from 'h3'
import { useSupabaseAdmin } from '../../utils/supabase'
import { formatPhone, isValidPhone, normalizePhone } from '#shared/utils/phone'

interface LookupBody {
  phone?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<LookupBody>(event)
  const phone = normalizePhone(body.phone || '')

  if (!isValidPhone(phone)) {
    throw createError({ statusCode: 400, statusMessage: 'Телефон должен содержать 9 цифр (без +992)' })
  }

  const supabase = useSupabaseAdmin()

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, name, phone')
    .eq('phone', phone)
    .maybeSingle()

  if (customerError) {
    throw createError({ statusCode: 500, statusMessage: customerError.message })
  }

  if (!customer) {
    return {
      found: false,
      phone,
      displayPhone: formatPhone(phone),
      customer: null,
      goods: [],
      stats: {
        totalCount: 0,
        totalWeight: 0,
        totalRevenue: 0,
        unpaidCount: 0,
        unpaidRevenue: 0,
        paidCount: 0,
        paidRevenue: 0,
      },
    }
  }

  const { data: rows, error: goodsError } = await supabase
    .from('goods')
    .select('weight, price, has_paid, created_at')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (goodsError) {
    throw createError({ statusCode: 500, statusMessage: goodsError.message })
  }

  const goods = (rows ?? []).map(row => ({
    weight: Number(row.weight),
    price: Number(row.price),
    has_paid: Boolean(row.has_paid),
    created_at: String(row.created_at),
  }))

  const unpaid = goods.filter(g => !g.has_paid)
  const paid = goods.filter(g => g.has_paid)

  return {
    found: true,
    phone,
    displayPhone: formatPhone(phone),
    customer: {
      name: customer.name,
      phone: customer.phone,
    },
    goods,
    stats: {
      totalCount: goods.length,
      totalWeight: goods.reduce((s, g) => s + g.weight, 0),
      totalRevenue: goods.reduce((s, g) => s + g.price, 0),
      unpaidCount: unpaid.length,
      unpaidRevenue: unpaid.reduce((s, g) => s + g.price, 0),
      paidCount: paid.length,
      paidRevenue: paid.reduce((s, g) => s + g.price, 0),
    },
  }
})
