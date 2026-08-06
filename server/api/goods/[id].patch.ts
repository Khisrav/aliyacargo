import { createError, getRouterParam, readBody } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { GOODS_SELECT, mapGoodRow, useSupabaseAdmin } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const user = requireTelegramAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id' })
  }

  if (event.method !== 'PATCH') {
    throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
  }

  const body = await readBody<{
    has_paid?: boolean
    weight?: number | string
    name?: string
  }>(event)

  const hasPaidPatch = typeof body.has_paid === 'boolean'
  const hasWeight = body.weight != null && body.weight !== ''
  const hasName = typeof body.name === 'string'

  if (!hasPaidPatch && !hasWeight && !hasName) {
    throw createError({ statusCode: 400, statusMessage: 'Нет данных для обновления' })
  }

  const supabase = useSupabaseAdmin()
  const config = useRuntimeConfig()
  const now = new Date().toISOString()

  const { data: existing, error: findError } = await supabase
    .from('goods')
    .select('id, acceptance_id, weight, name, has_paid')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (findError) {
    throw createError({ statusCode: 500, statusMessage: findError.message })
  }
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Запись не найдена' })
  }

  const patch: Record<string, unknown> = { updated_at: now }

  // Payment can be toggled anytime
  if (hasPaidPatch) {
    const acceptedBy = user.username ?? user.first_name ?? String(user.id)
    if (body.has_paid) {
      patch.has_paid = true
      patch.paid_at = now
      patch.payment_accepted_by = acceptedBy
    }
    else {
      patch.has_paid = false
      patch.paid_at = null
      patch.payment_accepted_by = null
    }
  }

  // Weight / name only while acceptance is open
  if (hasWeight || hasName) {
    const { data: acceptance, error: accError } = await supabase
      .from('acceptances')
      .select('id, status, total_weight')
      .eq('id', existing.acceptance_id)
      .is('deleted_at', null)
      .maybeSingle()

    if (accError) {
      throw createError({ statusCode: 500, statusMessage: accError.message })
    }
    if (!acceptance || acceptance.status !== 'open') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Редактировать товар можно только пока приёмка открыта',
      })
    }

    if (hasName) {
      const name = body.name!.trim()
      if (!name) {
        throw createError({ statusCode: 400, statusMessage: 'Укажите название / имя' })
      }
      patch.name = name
    }

    if (hasWeight) {
      const weight = Number(body.weight)
      if (!Number.isFinite(weight) || weight <= 0) {
        throw createError({ statusCode: 400, statusMessage: 'Вес должен быть больше 0' })
      }

      const { data: siblings } = await supabase
        .from('goods')
        .select('id, weight')
        .eq('acceptance_id', existing.acceptance_id)
        .is('deleted_at', null)

      const othersWeight = (siblings ?? [])
        .filter(g => Number(g.id) !== id)
        .reduce((s, g) => s + Number(g.weight), 0)

      if (othersWeight + weight > Number(acceptance.total_weight) + 0.05) {
        throw createError({
          statusCode: 400,
          statusMessage: `Превышен вес приёмки (${acceptance.total_weight} кг)`,
        })
      }

      const pricePerKg = Number(config.pricePerKg) || 30
      patch.weight = weight
      patch.price = Math.round(weight * pricePerKg * 100) / 100
    }
  }

  const { data, error } = await supabase
    .from('goods')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select(GOODS_SELECT)
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return mapGoodRow(data as Record<string, any>)
})
