import { createError } from 'h3'
import { requireTelegramAuth } from '../../../utils/auth'
import { useSupabaseAdmin } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Неверный идентификатор записи' })
  }

  const supabase = useSupabaseAdmin()

  // Soft-delete goods only while acceptance is open
  const { data: good, error: findError } = await supabase
    .from('goods')
    .select('id, acceptance_id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (findError) {
    throw createError({ statusCode: 500, statusMessage: findError.message })
  }
  if (!good) {
    throw createError({ statusCode: 404, statusMessage: 'Запись не найдена' })
  }

  const { data: acceptance } = await supabase
    .from('acceptances')
    .select('status')
    .eq('id', good.acceptance_id)
    .maybeSingle()

  if (!acceptance || acceptance.status !== 'open') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Удалять товар можно только пока приёмка открыта',
    })
  }

  const deletedAt = new Date().toISOString()

  const { data, error } = await supabase
    .from('goods')
    .update({ deleted_at: deletedAt, updated_at: deletedAt })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Запись не найдена' })
  }

  return { ok: true, id: data.id }
})
