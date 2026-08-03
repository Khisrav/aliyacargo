import { createError, getQuery } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { GOODS_SELECT, mapGoodRow, useSupabaseAdmin } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)
  const query = getQuery(event)

  const paid = typeof query.paid === 'string' ? query.paid : 'unpaid'
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const acceptanceId = query.acceptance_id != null ? Number(query.acceptance_id) : null
  const clientId = query.client_id != null ? Number(query.client_id) : null

  const supabase = useSupabaseAdmin()
  let builder = supabase
    .from('goods')
    .select(GOODS_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (paid === 'paid') builder = builder.eq('has_paid', true)
  else if (paid === 'unpaid') builder = builder.eq('has_paid', false)

  if (Number.isFinite(acceptanceId) && acceptanceId! > 0) {
    builder = builder.eq('acceptance_id', acceptanceId)
  }
  if (Number.isFinite(clientId) && clientId! > 0) {
    builder = builder.eq('client_id', clientId)
  }

  if (search) {
    const digits = search.replace(/\D/g, '')
    const { data: clients } = await supabase
      .from('clients')
      .select('id')
      .is('deleted_at', null)
      .or(
        digits
          ? `name.ilike.%${search}%,phone.ilike.%${digits}%`
          : `name.ilike.%${search}%`,
      )
      .limit(200)

    const ids = (clients ?? []).map(c => c.id)
    if (!ids.length) return []
    builder = builder.in('client_id', ids)
  }

  const { data, error } = await builder
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return (data ?? []).map(row => mapGoodRow(row as Record<string, any>))
})
