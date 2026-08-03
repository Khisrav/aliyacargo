import { createError, readBody } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { upsertClientByPhone } from '../../utils/clients'
import { GOODS_SELECT, mapGoodRow, useSupabaseAdmin } from '../../utils/supabase'

interface CreateGoodBody {
  phone?: string
  name?: string
  weight?: number | string
  acceptance_id?: number | string
  good_name?: string
}

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)
  const config = useRuntimeConfig()
  const body = await readBody<CreateGoodBody>(event)

  const weight = Number(body.weight)
  if (!Number.isFinite(weight) || weight <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Вес должен быть больше 0' })
  }

  const supabase = useSupabaseAdmin()
  let acceptanceId = body.acceptance_id != null ? Number(body.acceptance_id) : NaN

  if (!Number.isFinite(acceptanceId) || acceptanceId <= 0) {
    const { data: open } = await supabase
      .from('acceptances')
      .select('id, status, total_weight')
      .eq('status', 'open')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()

    if (!open) {
      throw createError({ statusCode: 400, statusMessage: 'Нет открытой приёмки. Создайте приёмку перед сортировкой.' })
    }
    acceptanceId = Number(open.id)
  }

  const { data: acceptance, error: accError } = await supabase
    .from('acceptances')
    .select('id, status, total_weight')
    .eq('id', acceptanceId)
    .is('deleted_at', null)
    .maybeSingle()

  if (accError) {
    throw createError({ statusCode: 500, statusMessage: accError.message })
  }
  if (!acceptance) {
    throw createError({ statusCode: 404, statusMessage: 'Приёмка не найдена' })
  }
  if (acceptance.status !== 'open') {
    throw createError({ statusCode: 400, statusMessage: 'Приёмка закрыта — добавлять товары нельзя' })
  }

  const client = await upsertClientByPhone(body.phone || '', body.name || '')
  const pricePerKg = Number(config.pricePerKg) || 30
  const price = Math.round(weight * pricePerKg * 100) / 100
  const goodName = body.good_name?.trim() || client.name

  const { data: existingGoods } = await supabase
    .from('goods')
    .select('weight')
    .eq('acceptance_id', acceptanceId)
    .is('deleted_at', null)

  const sortedSoFar = (existingGoods ?? []).reduce((s, g) => s + Number(g.weight), 0)
  if (sortedSoFar + weight > Number(acceptance.total_weight) + 0.05) {
    throw createError({
      statusCode: 400,
      statusMessage: `Превышен вес приёмки (${acceptance.total_weight} кг). Уже отсортировано ${Math.round(sortedSoFar * 1000) / 1000} кг.`,
    })
  }

  const { data, error } = await supabase
    .from('goods')
    .insert({
      acceptance_id: acceptanceId,
      client_id: client.id,
      name: goodName,
      weight,
      price,
      has_paid: false,
    })
    .select(GOODS_SELECT)
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return mapGoodRow(data as Record<string, any>)
})
