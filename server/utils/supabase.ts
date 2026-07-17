import { createClient } from '@supabase/supabase-js'
import { createError } from 'h3'

export interface CustomerGood {
  id: number
  name: string
  code: number
  weight: number
  price: number
  has_paid: boolean
  created_at: string
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
