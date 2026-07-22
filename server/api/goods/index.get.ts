import { createError, getQuery } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { GOODS_SELECT, mapGoodRow, useSupabaseAdmin } from '../../utils/supabase'
import { digitsOnly } from '#shared/utils/phone'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)

  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const paid = typeof query.paid === 'string' ? query.paid : 'all'
  const dateFrom = typeof query.dateFrom === 'string' ? query.dateFrom : ''
  const dateTo = typeof query.dateTo === 'string' ? query.dateTo : ''

  const supabase = useSupabaseAdmin()

  let customerIds: number[] | null = null

  if (search) {
    const phoneDigits = digitsOnly(search)
    let customerQuery = supabase.from('customers').select('id')

    if (phoneDigits.length >= 3) {
      customerQuery = customerQuery.or(`name.ilike.%${search}%,phone.ilike.%${phoneDigits}%`)
    }
    else {
      customerQuery = customerQuery.ilike('name', `%${search}%`)
    }

    const { data: customers, error: customerError } = await customerQuery.limit(200)
    if (customerError) {
      throw createError({ statusCode: 500, statusMessage: customerError.message })
    }

    customerIds = (customers ?? []).map(c => c.id)
    if (!customerIds.length) {
      return []
    }
  }

  let builder = supabase
    .from('goods')
    .select(GOODS_SELECT)
    .order('created_at', { ascending: false })
    .limit(500)

  if (customerIds) {
    builder = builder.in('customer_id', customerIds)
  }

  if (paid === 'paid') {
    builder = builder.eq('has_paid', true)
  }
  else if (paid === 'unpaid') {
    builder = builder.eq('has_paid', false)
  }

  if (dateFrom) {
    builder = builder.gte('created_at', `${dateFrom}T00:00:00.000Z`)
  }

  if (dateTo) {
    builder = builder.lte('created_at', `${dateTo}T23:59:59.999Z`)
  }

  const { data, error } = await builder

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return (data ?? []).map(mapGoodRow)
})
