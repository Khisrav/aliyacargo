import type { H3Event } from 'h3'
import { createError, getHeader } from 'h3'
import { isAllowedNickname, parseTelegramUser, type TelegramUser } from './telegram'

const DEV_MOCK_USER: TelegramUser = {
  id: 0,
  first_name: 'Dev',
  username: 'dev',
}

export function requireTelegramAuth(event: H3Event): TelegramUser {
  const config = useRuntimeConfig()
  const initData = getHeader(event, 'x-telegram-init-data')

  if (!initData) {
    if (import.meta.dev) {
      return DEV_MOCK_USER
    }

    throw createError({ statusCode: 401, statusMessage: 'Отсутствуют данные авторизации Telegram' })
  }

  const user = parseTelegramUser(initData, config.telegramBotToken)

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Неверные данные авторизации Telegram' })
  }

  if (!isAllowedNickname(user.username, config.allowedNicknames)) {
    if (import.meta.dev) {
      return user
    }

    throw createError({ statusCode: 403, statusMessage: 'Доступ запрещён' })
  }

  return user
}
