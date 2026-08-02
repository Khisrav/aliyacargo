import { createError } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { mapReportRow, REPORT_SELECT } from '../../utils/reports'
import { useSupabaseAdmin } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id отчёта' })
  }

  if (event.method !== 'GET') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Отчёты нельзя изменять или удалять',
    })
  }

  const supabase = useSupabaseAdmin()
  const { data, error } = await supabase
    .from('reports')
    .select(REPORT_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Отчёт не найден' })
  }

  return mapReportRow(data as Record<string, any>)
})
