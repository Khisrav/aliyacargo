import { createError, readBody } from 'h3'
import { normalizeTrackCode } from '#shared/utils/tracks'
import { findGoodByTrackCode } from '../../utils/supabase'

interface TrackBody {
  code?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<TrackBody>(event)
  const code = normalizeTrackCode(typeof body.code === 'string' ? body.code : '')

  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Введите трек-номер' })
  }

  const good = await findGoodByTrackCode(code)
  if (!good) {
    return { found: false, code }
  }

  return {
    found: true,
    code,
    weight: good.weight,
    price: good.price,
    has_paid: good.has_paid,
    created_at: good.created_at,
    paid_at: good.paid_at,
  }
})
