import type { AcceptanceStats } from '#shared/types/domain'

export interface GoodsAggregate {
  goods_count: number
  sorted_weight: number
  paid_count: number
  paid_weight: number
  paid_revenue: number
  unpaid_count: number
  unpaid_weight: number
  unpaid_revenue: number
  total_revenue: number
  clients: Set<number>
  first_payment_at: string | null
  last_payment_at: string | null
}

export function emptyAggregate(): GoodsAggregate {
  return {
    goods_count: 0,
    sorted_weight: 0,
    paid_count: 0,
    paid_weight: 0,
    paid_revenue: 0,
    unpaid_count: 0,
    unpaid_weight: 0,
    unpaid_revenue: 0,
    total_revenue: 0,
    clients: new Set(),
    first_payment_at: null,
    last_payment_at: null,
  }
}

export function addGood(agg: GoodsAggregate, row: Record<string, any>) {
  const weight = Number(row.weight)
  const price = Number(row.price)
  const paid = Boolean(row.has_paid)

  agg.goods_count += 1
  agg.sorted_weight += weight
  agg.total_revenue += price
  agg.clients.add(Number(row.client_id))

  if (paid) {
    agg.paid_count += 1
    agg.paid_weight += weight
    agg.paid_revenue += price

    const paidAt = row.paid_at ? String(row.paid_at) : null
    if (paidAt) {
      if (!agg.first_payment_at || paidAt < agg.first_payment_at) agg.first_payment_at = paidAt
      if (!agg.last_payment_at || paidAt > agg.last_payment_at) agg.last_payment_at = paidAt
    }
  }
  else {
    agg.unpaid_count += 1
    agg.unpaid_weight += weight
    agg.unpaid_revenue += price
  }
}

export function money(n: number) {
  return Math.round(n * 100) / 100
}

export function weight(n: number) {
  return Math.round(n * 1000) / 1000
}

export function rate(part: number, whole: number) {
  if (!whole) return 0
  return Math.round((part / whole) * 1000) / 10
}

export function buildAcceptanceStats(row: Record<string, any>, agg: GoodsAggregate): AcceptanceStats {
  const totalWeight = Number(row.total_weight)
  const sortedWeight = weight(agg.sorted_weight)
  const cost = Number(row.paid_tjs)
  const closed = row.status === 'closed'

  // Waste is only decided when the batch closes. Packages deleted afterwards
  // shrink the sorted total without touching the frozen waste, so surface that
  // gap separately instead of letting the weights silently stop adding up.
  const wasteWeight = closed
    ? (row.waste_weight != null
        ? Number(row.waste_weight)
        : weight(Math.max(0, totalWeight - agg.sorted_weight)))
    : null
  const removedWeight = closed
    ? weight(Math.max(0, totalWeight - agg.sorted_weight - (wasteWeight ?? 0)))
    : 0
  const unsortedWeight = closed ? 0 : weight(Math.max(0, totalWeight - agg.sorted_weight))

  return {
    id: Number(row.id),
    accepted_at: String(row.accepted_at),
    status: row.status === 'closed' ? 'closed' : 'open',
    closed_at: row.closed_at ?? null,
    total_weight: weight(totalWeight),
    sorted_weight: sortedWeight,
    waste_weight: wasteWeight,
    unsorted_weight: unsortedWeight,
    removed_weight: removedWeight,
    sorting_rate: rate(agg.sorted_weight, totalWeight),
    goods_count: agg.goods_count,
    paid_count: agg.paid_count,
    unpaid_count: agg.unpaid_count,
    clients_count: agg.clients.size,
    total_revenue: money(agg.total_revenue),
    paid_revenue: money(agg.paid_revenue),
    unpaid_revenue: money(agg.unpaid_revenue),
    payment_rate: rate(agg.paid_revenue, agg.total_revenue),
    cost: money(cost),
    cost_per_kg: Number(row.cost_per_kg ?? 0),
    margin: money(agg.total_revenue - cost),
    realized: money(agg.paid_revenue - cost),
  }
}
