import { createError, readBody } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { GOODS_SELECT, mapGoodRow, useSupabaseAdmin } from '../../utils/supabase'
import { isValidPhone, normalizePhone } from '#shared/utils/phone'

interface CreateGoodBody {
  phone?: string
  name?: string
  weight?: number | string
}

export default defineEventHandler(async (event) => {
  const user = requireTelegramAuth(event)
  const config = useRuntimeConfig()
  const body = await readBody<CreateGoodBody>(event)

  const phone = normalizePhone(body.phone || '')
  const name = body.name?.trim() || ''
  const weight = Number(body.weight)

  if (!isValidPhone(phone)) {
    throw createError({ statusCode: 400, statusMessage: 'Телефон должен содержать 9 цифр' })
  }

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Укажите имя клиента' })
  }

  if (!Number.isFinite(weight) || weight <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Вес должен быть больше 0' })
  }

  const pricePerKg = Number(config.pricePerKg) || 1000
  const price = Math.round(weight * pricePerKg * 100) / 100
  const createdBy = user.username ?? String(user.id)
  const supabase = useSupabaseAdmin()

  const { data: existing, error: lookupError } = await supabase
    .from('customers')
    .select('id, phone, name')
    .eq('phone', phone)
    .maybeSingle()

  if (lookupError) {
    throw createError({ statusCode: 500, statusMessage: lookupError.message })
  }

  let customerId = existing?.id as number | undefined

  if (existing) {
    if (existing.name !== name) {
      const { error: updateError } = await supabase
        .from('customers')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', existing.id)

      if (updateError) {
        throw createError({ statusCode: 500, statusMessage: updateError.message })
      }
    }
  }
  else {
    const { data: created, error: createErrorDb } = await supabase
      .from('customers')
      .insert({ phone, name })
      .select('id')
      .single()

    if (createErrorDb) {
      throw createError({ statusCode: 500, statusMessage: createErrorDb.message })
    }

    customerId = created.id
  }

  const { data, error } = await supabase
    .from('goods')
    .insert({
      customer_id: customerId,
      weight,
      price,
      has_paid: false,
      created_by: createdBy,
    })
    .select(GOODS_SELECT)
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return mapGoodRow(data as Record<string, any>)
})
