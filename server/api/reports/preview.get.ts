import { requireTelegramAuth } from '../../utils/auth'
import { buildTodayReportDraft } from '../../utils/reportDraft'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)
  return await buildTodayReportDraft()
})
