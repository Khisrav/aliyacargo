import { createError, getRouterParam, readBody } from 'h3'
import { isValidPhone, normalizePhone } from '#shared/utils/phone'
import type { Client } from '#shared/types/domain'
import { requireTelegramAuth } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  requireTelegramAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id клиента' })
  }

  const body = await readBody<{ name?: string, phone?: string }>(event)
  const patch: { name?: string, phone?: string, updated_at: string } = {
    updated_at: new Date().toISOString(),
  }

  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (!name) {
      throw createError({ statusCode: 400, statusMessage: 'Укажите имя клиента' })
    }
    patch.name = name
  }

  if (typeof body.phone === 'string') {
    const phone = normalizePhone(body.phone)
    if (!isValidPhone(phone)) {
      throw createError({ statusCode: 400, statusMessage: 'Телефон должен содержать 9 цифр' })
    }
    patch.phone = phone
  }

  if (patch.name == null && patch.phone == null) {
    throw createError({ statusCode: 400, statusMessage: 'Нет данных для обновления' })
  }

  const supabase = useSupabaseAdmin()

  const { data: current, error: currentError } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (currentError) {
    throw createError({ statusCode: 500, statusMessage: currentError.message })
  }
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Клиент не найден' })
  }

  if (patch.phone) {
    const { data: taken, error: takenError } = await supabase
      .from('clients')
      .select('id')
      .eq('phone', patch.phone)
      .is('deleted_at', null)
      .neq('id', id)
      .maybeSingle()

    if (takenError) {
      throw createError({ statusCode: 500, statusMessage: takenError.message })
    }
    if (taken) {
      throw createError({ statusCode: 409, statusMessage: 'Клиент с таким телефоном уже есть' })
    }
  }

  const { data, error } = await supabase
    .from('clients')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, name, phone, created_at, updated_at')
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'Клиент с таким телефоном уже есть' })
    }
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Клиент не найден' })
  }

  // Packages created from the client name keep that snapshot. A typo fix should
  // follow them; a name that was edited on purpose stays as written.
  if (patch.name && patch.name !== current.name) {
    const { error: goodsError } = await supabase
      .from('goods')
      .update({ name: patch.name, updated_at: patch.updated_at })
      .eq('client_id', id)
      .eq('name', current.name)

    if (goodsError) {
      throw createError({ statusCode: 500, statusMessage: goodsError.message })
    }
  }

  const client: Client = {
    id: Number(data.id),
    name: String(data.name),
    phone: String(data.phone),
    created_at: String(data.created_at),
    updated_at: String(data.updated_at),
  }

  return client
})
