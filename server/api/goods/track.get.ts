import { createError, getQuery } from 'h3'
import { normalizeTrackCode } from '#shared/utils/tracks'
import { requireTelegramAuth } from '../../utils/auth'
import { findGoodByTrackCode } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)

  const query = getQuery(event)
  const raw = typeof query.code === 'string' ? query.code : ''
  const code = normalizeTrackCode(raw)

  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Введите трек-номер' })
  }

  const good = await findGoodByTrackCode(code)
  if (!good) {
    return { found: false, code }
  }

  return { found: true, code, good }
})
