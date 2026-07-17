import { validateWebAppData } from '@grammyjs/validator'

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
}

export function parseTelegramUser(initData: string, botToken: string): TelegramUser | null {
  const params = new URLSearchParams(initData)

  if (!validateWebAppData(botToken, params)) {
    return null
  }

  const userJson = params.get('user')
  if (!userJson) {
    return null
  }

  try {
    return JSON.parse(userJson) as TelegramUser
  }
  catch {
    return null
  }
}

export function isAllowedNickname(username: string | undefined, allowedList: string): boolean {
  if (!username) {
    return false
  }

  const allowed = allowedList
    .split(',')
    .map(n => n.trim().toLowerCase())
    .filter(Boolean)

  return allowed.includes(username.toLowerCase())
}
