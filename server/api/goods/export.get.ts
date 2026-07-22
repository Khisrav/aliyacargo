import { createError, getQuery } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { GOODS_SELECT, mapGoodRow, useSupabaseAdmin, type CustomerGood } from '../../utils/supabase'

const PAGE_SIZE = 1000

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)

  const query = getQuery(event)
  const dateFrom = typeof query.dateFrom === 'string' ? query.dateFrom : ''
  const dateTo = typeof query.dateTo === 'string' ? query.dateTo : ''
  const rows: CustomerGood[] = []
  const supabase = useSupabaseAdmin()

  for (let from = 0; ; from += PAGE_SIZE) {
    let builder = supabase
      .from('goods')
      .select(GOODS_SELECT)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

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

    rows.push(...(data ?? []).map(mapGoodRow))

    if (!data || data.length < PAGE_SIZE) {
      break
    }
  }

  return rows
})
