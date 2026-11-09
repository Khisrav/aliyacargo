import { createError, getQuery, readBody } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { mapFinanceRow } from '../../utils/finance'
import { fetchAllPages } from '../../utils/pagination'
import { addDateKeyDays, businessDayStart, parseDateParam } from '../../utils/period'
import { useSupabaseAdmin } from '../../utils/supabase'
import type { FinanceType } from '#shared/types/domain'

export default defineEventHandler(async (event) => {
  const user = requireTelegramAuth(event)
  const method = event.method

  if (method === 'GET') {
    const query = getQuery(event)
    const type = typeof query.type === 'string' ? query.type : 'all'
    const search = typeof query.search === 'string' ? query.search.trim() : ''
    // Business days in Asia/Dushanbe, the same boundaries the daily reports use.
    const dateFrom = parseDateParam(query.dateFrom, 'dateFrom')
    const dateTo = parseDateParam(query.dateTo, 'dateTo')

    const supabase = useSupabaseAdmin()
    const rows = await fetchAllPages<Record<string, any>>((from, to) => {
      let builder = supabase
        .from('finance_records')
        .select('id, type, amount, note, created_by, created_at')
        .is('deleted_at', null)

      if (type === 'income' || type === 'expense') {
        builder = builder.eq('type', type)
      }
      if (search) {
        builder = builder.ilike('note', `%${search}%`)
      }
      if (dateFrom) {
        builder = builder.gte('created_at', businessDayStart(dateFrom).toISOString())
      }
      if (dateTo) {
        builder = builder.lt('created_at', businessDayStart(addDateKeyDays(dateTo, 1)).toISOString())
      }

      return builder
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to)
    })

    return rows.map(row => mapFinanceRow(row))
  }

  if (method === 'POST') {
    const body = await readBody<{ type?: string, amount?: number | string, note?: string }>(event)
    const type = body.type === 'income' ? 'income' : body.type === 'expense' ? 'expense' : null
    const amount = Number(body.amount)
    const note = body.note?.trim() || ''

    if (!type) {
      throw createError({ statusCode: 400, statusMessage: 'Укажите тип: income или expense' })
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw createError({ statusCode: 400, statusMessage: 'Сумма должна быть больше 0' })
    }
    if (!note) {
      throw createError({ statusCode: 400, statusMessage: 'Укажите причину / комментарий' })
    }

    const createdBy = user.username ?? String(user.id)
    const supabase = useSupabaseAdmin()
    const { data, error } = await supabase
      .from('finance_records')
      .insert({
        type: type as FinanceType,
        amount: Math.round(amount * 100) / 100,
        note,
        created_by: createdBy,
      })
      .select('id, type, amount, note, created_by, created_at')
      .single()

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    return mapFinanceRow(data as Record<string, any>)
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
