import { requireTelegramAuth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = requireTelegramAuth(event)
  const config = useRuntimeConfig()

  return {
    ok: true,
    pricePerKg: Number(config.pricePerKg) || 1000,
    user: { id: user.id, username: user.username, first_name: user.first_name },
  }
})
