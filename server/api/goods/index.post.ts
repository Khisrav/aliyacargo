import { createError, readBody } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'

interface CreateGoodBody {
  name?: string
  code?: string
  weight?: number | string
}

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)
  const config = useRuntimeConfig()
  const body = await readBody<CreateGoodBody>(event)

  const name = body.name?.trim()
  const code = body.code?.trim()
  const weight = Number(body.weight)

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Укажите имя клиента' })
  }

  if (!code || !/^\d{4}$/.test(code)) {
    throw createError({ statusCode: 400, statusMessage: 'Код должен состоять ровно из 4 цифр' })
  }

  if (!Number.isFinite(weight) || weight <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Вес должен быть больше 0' })
  }

  const pricePerKg = Number(config.pricePerKg) || 1000
  const price = Math.round(weight * pricePerKg * 100) / 100

  const supabase = useSupabaseAdmin()
  const { data, error } = await supabase
    .from('goods')
    .insert({
      name,
      code: Number(code),
      weight,
      price,
      has_paid: false,
    })
    .select()
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
