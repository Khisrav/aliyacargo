import { createError, readBody } from 'h3'
import { fetchAllPages } from '../../utils/pagination'
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

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, name, phone')
    .eq('phone', phone)
    .is('deleted_at', null)
    .maybeSingle()

  if (clientError) {
    throw createError({ statusCode: 500, statusMessage: clientError.message })
  }

  if (!client) {
    return {
      found: false,
      phone,
      displayPhone: formatPhone(phone),
      client: null,
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

  const rows = await fetchAllPages((from, to) =>
    supabase
      .from('goods')
      .select('id, weight, price, has_paid, created_at')
      .eq('client_id', client.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to),
  )

  // Totals cover every package; only the newest are listed.
  const goods = rows.map(row => ({
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
    client: {
      name: client.name,
      phone: client.phone,
    },
    goods: goods.slice(0, 200),
    stats: {
      totalCount: goods.length,
      totalWeight: Math.round(goods.reduce((s, g) => s + g.weight, 0) * 1000) / 1000,
      totalRevenue: Math.round(goods.reduce((s, g) => s + g.price, 0) * 100) / 100,
      unpaidCount: unpaid.length,
      unpaidRevenue: Math.round(unpaid.reduce((s, g) => s + g.price, 0) * 100) / 100,
      paidCount: paid.length,
      paidRevenue: Math.round(paid.reduce((s, g) => s + g.price, 0) * 100) / 100,
    },
  }
})
