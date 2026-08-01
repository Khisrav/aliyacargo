import { createError, readBody } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { mapFinanceRow, type FinanceType } from '../../utils/finance'
import { useSupabaseAdmin } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)
  const method = event.method
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Неверный идентификатор записи' })
  }

  const supabase = useSupabaseAdmin()

  if (method === 'PATCH') {
    const body = await readBody<{ type?: string, amount?: number | string, note?: string }>(event)
    const patch: Record<string, unknown> = {}

    if (body.type != null) {
      if (body.type !== 'income' && body.type !== 'expense') {
        throw createError({ statusCode: 400, statusMessage: 'Укажите тип: income или expense' })
      }
      patch.type = body.type as FinanceType
    }

    if (body.amount != null) {
      const amount = Number(body.amount)
      if (!Number.isFinite(amount) || amount <= 0) {
        throw createError({ statusCode: 400, statusMessage: 'Сумма должна быть больше 0' })
      }
      patch.amount = Math.round(amount * 100) / 100
    }

    if (body.note != null) {
      const note = body.note.trim()
      if (!note) {
        throw createError({ statusCode: 400, statusMessage: 'Укажите причину / комментарий' })
      }
      patch.note = note
    }

    if (!Object.keys(patch).length) {
      throw createError({ statusCode: 400, statusMessage: 'Нет данных для обновления' })
    }

    const { data, error } = await supabase
      .from('finance_records')
      .update(patch)
      .eq('id', id)
      .is('deleted_at', null)
      .select('id, type, amount, note, created_by, created_at')
      .maybeSingle()

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }
    if (!data) {
      throw createError({ statusCode: 404, statusMessage: 'Запись не найдена' })
    }

    return mapFinanceRow(data as Record<string, any>)
  }

  if (method === 'DELETE') {
    const deletedAt = new Date().toISOString()
    const { data, error } = await supabase
      .from('finance_records')
      .update({ deleted_at: deletedAt })
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
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
