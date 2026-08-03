import { createError, getRouterParam, readBody } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { GOODS_SELECT, mapAcceptanceRow, mapGoodRow, useSupabaseAdmin } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id приёмки' })
  }

  const method = event.method
  const supabase = useSupabaseAdmin()

  if (method === 'GET') {
    const { data, error } = await supabase
      .from('acceptances')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }
    if (!data) {
      throw createError({ statusCode: 404, statusMessage: 'Приёмка не найдена' })
    }

    const { data: goods, error: goodsError } = await supabase
      .from('goods')
      .select(GOODS_SELECT)
      .eq('acceptance_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (goodsError) {
      throw createError({ statusCode: 500, statusMessage: goodsError.message })
    }

    const mappedGoods = (goods ?? []).map(row => mapGoodRow(row as Record<string, any>))
    const sortedWeight = mappedGoods.reduce((s, g) => s + g.weight, 0)

    return {
      acceptance: mapAcceptanceRow(data as Record<string, any>, {
        sorted_weight: Math.round(sortedWeight * 1000) / 1000,
        goods_count: mappedGoods.length,
      }),
      goods: mappedGoods,
    }
  }

  if (method === 'POST') {
    // Close acceptance
    const body = await readBody<{ confirm?: boolean }>(event).catch(() => ({} as { confirm?: boolean }))

    const { data: acceptance, error } = await supabase
      .from('acceptances')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }
    if (!acceptance) {
      throw createError({ statusCode: 404, statusMessage: 'Приёмка не найдена' })
    }
    if (acceptance.status === 'closed') {
      throw createError({ statusCode: 400, statusMessage: 'Приёмка уже закрыта' })
    }

    const { data: goods, error: goodsError } = await supabase
      .from('goods')
      .select('weight')
      .eq('acceptance_id', id)
      .is('deleted_at', null)

    if (goodsError) {
      throw createError({ statusCode: 500, statusMessage: goodsError.message })
    }

    const sortedWeight = (goods ?? []).reduce((s, g) => s + Number(g.weight), 0)
    const totalWeight = Number(acceptance.total_weight)
    const wasteWeight = Math.max(0, Math.round((totalWeight - sortedWeight) * 1000) / 1000)

    if ((goods ?? []).length === 0 && !body?.confirm) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Нет отсортированных товаров. Подтвердите закрытие — весь вес станет мусором.',
      })
    }

    if (sortedWeight > totalWeight + 0.05) {
      throw createError({
        statusCode: 400,
        statusMessage: `Сортировка (${sortedWeight} кг) больше принятого веса (${totalWeight} кг)`,
      })
    }

    const { data: updated, error: updateError } = await supabase
      .from('acceptances')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        waste_weight: wasteWeight,
      })
      .eq('id', id)
      .eq('status', 'open')
      .select('*')
      .single()

    if (updateError) {
      throw createError({ statusCode: 500, statusMessage: updateError.message })
    }

    return mapAcceptanceRow(updated as Record<string, any>, {
      sorted_weight: Math.round(sortedWeight * 1000) / 1000,
      goods_count: (goods ?? []).length,
    })
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
