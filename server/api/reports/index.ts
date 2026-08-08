import { createError, getQuery, readBody } from 'h3'
import { requireTelegramAuth } from '../../utils/auth'
import { businessDateKey, mapReportRow, parseReportDate } from '../../utils/reports'
import { useSupabaseAdmin } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)
  const method = event.method
  const supabase = useSupabaseAdmin()

  if (method === 'GET') {
    const query = getQuery(event)
    const limitRaw = Number(query.limit)
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 365) : 60

    let builder = supabase
      .from('daily_reports')
      .select('*')
      .order('report_date', { ascending: false })
      .limit(limit)

    if (typeof query.dateFrom === 'string' && query.dateFrom) {
      builder = builder.gte('report_date', parseReportDate(query.dateFrom, 'dateFrom'))
    }
    if (typeof query.dateTo === 'string' && query.dateTo) {
      builder = builder.lte('report_date', parseReportDate(query.dateTo, 'dateTo'))
    }

    const { data, error } = await builder
    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    return (data ?? []).map(row => mapReportRow(row as Record<string, any>))
  }

  // Recalculate a day on demand. The cron job does this at midnight, but today's
  // report only exists once someone asks for it.
  if (method === 'POST') {
    const body = await readBody<{ date?: string }>(event).catch(() => ({} as { date?: string }))
    const date = body?.date ? parseReportDate(body.date) : businessDateKey()

    if (date > businessDateKey()) {
      throw createError({ statusCode: 400, statusMessage: 'Нельзя построить отчёт за будущую дату' })
    }

    const { data, error } = await supabase.rpc('generate_daily_report', { target_date: date })
    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    return mapReportRow(data as Record<string, any>)
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
