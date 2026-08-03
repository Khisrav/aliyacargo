import { createClient } from '@supabase/supabase-js'
import { createError } from 'h3'
import type { Acceptance, Good } from '#shared/types/domain'

export function useSupabaseAdmin() {
  const config = useRuntimeConfig()

  if (!config.supabaseUrl || !config.supabaseServiceKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase не настроен. Укажите SUPABASE_URL и SUPABASE_SERVICE_KEY в .env и перезапустите сервер.',
    })
  }

  return createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export const GOODS_SELECT = `
  id,
  acceptance_id,
  client_id,
  name,
  weight,
  price,
  has_paid,
  paid_at,
  payment_accepted_by,
  created_at,
  updated_at,
  deleted_at,
  clients (
    id,
    phone,
    name,
    deleted_at
  )
`

export function mapGoodRow(row: Record<string, any>): Good {
  const client = row.clients ?? {}
  return {
    id: Number(row.id),
    acceptance_id: Number(row.acceptance_id),
    client_id: Number(row.client_id),
    name: String(row.name ?? ''),
    weight: Number(row.weight),
    price: Number(row.price),
    has_paid: Boolean(row.has_paid),
    paid_at: row.paid_at ?? null,
    payment_accepted_by: row.payment_accepted_by ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at ?? row.created_at),
    client_name: String(client.name ?? ''),
    phone: String(client.phone ?? ''),
  }
}

export function mapAcceptanceRow(
  row: Record<string, any>,
  extras?: { sorted_weight?: number, goods_count?: number },
): Acceptance {
  return {
    id: Number(row.id),
    accepted_at: String(row.accepted_at),
    total_weight: Number(row.total_weight),
    paid_tjs: Number(row.paid_tjs),
    cost_per_kg: Number(row.cost_per_kg),
    status: row.status === 'closed' ? 'closed' : 'open',
    closed_at: row.closed_at ?? null,
    waste_weight: row.waste_weight != null ? Number(row.waste_weight) : null,
    created_by: row.created_by ?? null,
    created_at: String(row.created_at),
    sorted_weight: extras?.sorted_weight,
    goods_count: extras?.goods_count,
  }
}
