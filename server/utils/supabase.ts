import { createClient } from '@supabase/supabase-js'
import { createError } from 'h3'

export interface Customer {
  id: number
  phone: string
  name: string
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface CustomerGood {
  id: number
  customer_id: number
  weight: number
  price: number
  has_paid: boolean
  initiator: string | null
  created_by: string | null
  created_at: string
  deleted_at?: string | null
  name: string
  phone: string
}

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

export function mapGoodRow(row: Record<string, any>): CustomerGood {
  const customer = row.customers ?? {}
  return {
    id: row.id,
    customer_id: row.customer_id,
    weight: Number(row.weight),
    price: Number(row.price),
    has_paid: Boolean(row.has_paid),
    initiator: row.initiator ?? null,
    created_by: row.created_by ?? null,
    created_at: row.created_at,
    deleted_at: row.deleted_at ?? null,
    name: customer.name ?? row.name ?? '',
    phone: customer.phone ?? row.phone ?? '',
  }
}

export const GOODS_SELECT = `
  id,
  customer_id,
  weight,
  price,
  has_paid,
  initiator,
  created_by,
  created_at,
  deleted_at,
  customers (
    id,
    phone,
    name,
    deleted_at
  )
`
