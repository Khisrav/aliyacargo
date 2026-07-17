import { Bot, InlineKeyboard } from 'grammy'

const token = process.env.TELEGRAM_BOT_TOKEN
const webAppUrl = process.env.NUXT_PUBLIC_APP_URL

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is required')
  process.exit(1)
}

if (!webAppUrl) {
  console.error('NUXT_PUBLIC_APP_URL is required (must be HTTPS)')
  process.exit(1)
}

const bot = new Bot(token)

bot.command('start', async (ctx) => {
  const keyboard = new InlineKeyboard().webApp('📦 Открыть Aliya Cargo', webAppUrl)

  await ctx.reply(
    'Добро пожаловать в Aliya Cargo!\n\nНажмите на кнопку ниже, чтобы взвесить и зарегистрировать груз.',
    { reply_markup: keyboard },
  )
})

bot.catch((err) => {
  console.error('Bot error:', err)
})

console.log('Bot starting...')
bot.start()
