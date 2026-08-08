import { createError, getRouterParam } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { businessDateKey, mapReportRow, parseReportDate } from '../../utils/reports'
import { useSupabaseAdmin } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)
  const date = parseReportDate(getRouterParam(event, 'date'))
  const supabase = useSupabaseAdmin()

  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('report_date', date)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (data) {
    return mapReportRow(data as Record<string, any>)
  }

  // Today has not closed yet, and the cron job may have missed a day, so build
  // the report on demand. Bounded to a recent window so that browsing far into
  // the past cannot fill the table with empty days.
  const today = businessDateKey()
  const earliest = businessDateKey(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))
  if (date > today || date < earliest) {
    throw createError({ statusCode: 404, statusMessage: 'Отчёт не найден' })
  }

  const { data: generated, error: rpcError } = await supabase
    .rpc('generate_daily_report', { target_date: date })

  if (rpcError) {
    throw createError({ statusCode: 500, statusMessage: rpcError.message })
  }

  return mapReportRow(generated as Record<string, any>)
})
