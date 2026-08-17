import { createError } from 'h3'
import { businessDateKey } from './reports'

export type StatsPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'

export const STATS_PERIODS = new Set<StatsPeriod>(['today', 'yesterday', 'week', 'month', 'all', 'custom'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Asia/Dushanbe is UTC+5 year-round (no DST). Matches generate_daily_report. */
const BUSINESS_OFFSET = '+05:00'

export interface PeriodRange {
  /** Inclusive start instant (timestamptz). */
  from: Date | null
  /** Exclusive end instant (timestamptz) — start of the day after `toKey`. */
  to: Date | null
  /** Inclusive YYYY-MM-DD in Asia/Dushanbe. */
  fromKey: string | null
  /** Inclusive YYYY-MM-DD in Asia/Dushanbe. */
  toKey: string | null
}

export function dateKey(d: Date) {
  return businessDateKey(d)
}

export function addDateKeyDays(key: string, days: number): string {
  const utc = new Date(`${key}T12:00:00.000Z`)
  utc.setUTCDate(utc.getUTCDate() + days)
  return utc.toISOString().slice(0, 10)
}

export function businessDayStart(key: string): Date {
  return new Date(`${key}T00:00:00${BUSINESS_OFFSET}`)
}

export function parseDateParam(value: unknown, label: string): string | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw createError({ statusCode: 400, statusMessage: `Invalid ${label}` })
  }
  const parsed = new Date(`${value}T12:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) {
    throw createError({ statusCode: 400, statusMessage: `Invalid ${label}` })
  }
  return value
}

function rangeForKeys(fromKey: string | null, toKey: string | null): PeriodRange {
  return {
    from: fromKey ? businessDayStart(fromKey) : null,
    to: toKey ? businessDayStart(addDateKeyDays(toKey, 1)) : null,
    fromKey,
    toKey,
  }
}

export function resolvePeriod(
  period: StatsPeriod,
  dateFromRaw: unknown,
  dateToRaw: unknown,
): PeriodRange {
  const today = businessDateKey()

  if (period === 'custom') {
    const fromKey = parseDateParam(dateFromRaw, 'dateFrom')
    const toKey = parseDateParam(dateToRaw, 'dateTo')

    if (!fromKey && !toKey) {
      throw createError({ statusCode: 400, statusMessage: 'dateFrom or dateTo is required for custom period' })
    }

    const resolvedToKey = toKey ?? today

    if (fromKey && fromKey > resolvedToKey) {
      throw createError({ statusCode: 400, statusMessage: 'dateFrom must be before dateTo' })
    }

    return rangeForKeys(fromKey, resolvedToKey)
  }

  switch (period) {
    case 'today':
      return rangeForKeys(today, today)
    case 'yesterday': {
      const day = addDateKeyDays(today, -1)
      return rangeForKeys(day, day)
    }
    case 'week':
      return rangeForKeys(addDateKeyDays(today, -6), today)
    case 'month':
      return rangeForKeys(addDateKeyDays(today, -29), today)
    case 'all':
    default:
      return { from: null, to: null, fromKey: null, toKey: null }
  }
}

export function marginPerKg(pricePerKg: number, costPerKg: number) {
  return Math.max(0, pricePerKg - costPerKg)
}
