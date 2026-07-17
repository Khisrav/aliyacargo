import { createError, getQuery } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)

  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const paid = typeof query.paid === 'string' ? query.paid : 'all'
  const dateFrom = typeof query.dateFrom === 'string' ? query.dateFrom : ''
  const dateTo = typeof query.dateTo === 'string' ? query.dateTo : ''

  const supabase = useSupabaseAdmin()
  let builder = supabase
    .from('goods')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

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

  if (search) {
    const codeSearch = /^\d+$/.test(search) ? search : null
    builder = codeSearch
      ? builder.or(`name.ilike.%${search}%,code.eq.${codeSearch}`)
      : builder.ilike('name', `%${search}%`)
  }

  const { data, error } = await builder

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
