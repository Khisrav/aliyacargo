import { createError, readBody } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import {
  buildReportSnapshot,
  mapReportRow,
  REPORT_SELECT,
  type ReportInput,
} from '../../utils/reports'
import { dateKey, startOfDay } from '../../utils/period'
import { useSupabaseAdmin } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const user = requireTelegramAuth(event)
  const method = event.method

  if (method === 'GET') {
    const supabase = useSupabaseAdmin()
    const { data, error } = await supabase
      .from('reports')
      .select(REPORT_SELECT)
      .order('report_date', { ascending: false })
      .limit(365)

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    return (data ?? []).map(row => mapReportRow(row as Record<string, any>))
  }

  if (method === 'POST') {
    const body = await readBody<ReportInput>(event)
    const today = dateKey(startOfDay(new Date()))
    const snapshot = buildReportSnapshot(body ?? {}, today)

    // Reports are always for the current UTC day only
    if (snapshot.report_date !== today) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Можно создать отчёт только за сегодняшний день',
      })
    }

    const createdBy = user.username ?? String(user.id)
    const supabase = useSupabaseAdmin()
    const { data, error } = await supabase
      .from('reports')
      .insert({
        ...snapshot,
        created_by: createdBy,
      })
      .select(REPORT_SELECT)
      .single()

    if (error) {
      if (error.code === '23505') {
        throw createError({
          statusCode: 409,
          statusMessage: 'Отчёт за сегодня уже создан и не может быть изменён',
        })
      }
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    return mapReportRow(data as Record<string, any>)
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
