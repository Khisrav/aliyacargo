import { createError, send, setHeader } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { mapAcceptanceRow, useSupabaseAdmin } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)
  const supabase = useSupabaseAdmin()

  const { data, error } = await supabase
    .from('acceptances')
    .select('*')
    .eq('status', 'open')
    .is('deleted_at', null)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (!data) {
    // Explicit JSON null — bare `return null` yields an empty body in Nitro
    setHeader(event, 'content-type', 'application/json; charset=utf-8')
    return send(event, 'null')
  }

  const { data: goods } = await supabase
    .from('goods')
    .select('weight')
    .eq('acceptance_id', data.id)
    .is('deleted_at', null)

  const sortedWeight = (goods ?? []).reduce((s, g) => s + Number(g.weight), 0)

  return mapAcceptanceRow(data as Record<string, any>, {
    sorted_weight: Math.round(sortedWeight * 1000) / 1000,
    goods_count: (goods ?? []).length,
  })
})
