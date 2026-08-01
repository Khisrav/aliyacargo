import { createError } from 'h3'

export type StatsPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'

export const STATS_PERIODS = new Set<StatsPeriod>(['today', 'yesterday', 'week', 'month', 'all', 'custom'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function dateKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function startOfDay(d: Date) {
  const result = new Date(d)
  result.setUTCHours(0, 0, 0, 0)
  return result
}

export function endOfDay(d: Date) {
  const result = new Date(d)
  result.setUTCHours(23, 59, 59, 999)
  return result
}

export function startOfWeek(d: Date) {
  const result = startOfDay(d)
  const day = result.getUTCDay()
  const diff = day === 0 ? 6 : day - 1
  result.setUTCDate(result.getUTCDate() - diff)
  return result
}

export function startOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

export function parseDateParam(value: unknown, label: string): Date | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw createError({ statusCode: 400, statusMessage: `Invalid ${label}` })
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) {
    throw createError({ statusCode: 400, statusMessage: `Invalid ${label}` })
  }
  return parsed
}

export function resolvePeriod(
  period: StatsPeriod,
  dateFromRaw: unknown,
  dateToRaw: unknown,
): { from: Date | null, to: Date | null } {
  const now = new Date()

  if (period === 'custom') {
    const fromDate = parseDateParam(dateFromRaw, 'dateFrom')
    const toDate = parseDateParam(dateToRaw, 'dateTo')

    if (!fromDate && !toDate) {
      throw createError({ statusCode: 400, statusMessage: 'dateFrom or dateTo is required for custom period' })
    }

    const from = fromDate ? startOfDay(fromDate) : null
    const to = toDate ? endOfDay(toDate) : endOfDay(now)

    if (from && to && from > to) {
      throw createError({ statusCode: 400, statusMessage: 'dateFrom must be before dateTo' })
    }

    return { from, to }
  }

  switch (period) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) }
    case 'yesterday': {
      const day = startOfDay(now)
      day.setUTCDate(day.getUTCDate() - 1)
      return { from: day, to: endOfDay(day) }
    }
    case 'week':
      return { from: startOfWeek(now), to: endOfDay(now) }
    case 'month':
      return { from: startOfMonth(now), to: endOfDay(now) }
    case 'all':
    default:
      return { from: null, to: null }
  }
}

export function marginPerKg(pricePerKg: number, costPerKg: number) {
  return Math.max(0, pricePerKg - costPerKg)
}
