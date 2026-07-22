import { Bot, InlineKeyboard } from 'grammy'
import { createClient } from '@supabase/supabase-js'
import { formatPhone, isValidPhone, normalizePhone } from '../shared/utils/phone'

const token = process.env.TELEGRAM_BOT_TOKEN
const webAppUrl = process.env.NUXT_PUBLIC_APP_URL
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is required')
  process.exit(1)
}

if (!webAppUrl) {
  console.error('NUXT_PUBLIC_APP_URL is required (must be HTTPS)')
  process.exit(1)
}

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required for customer lookup')
  process.exit(1)
}

const bot = new Bot(token)
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const trackUrl = `${webAppUrl.replace(/\/$/, '')}/track`

function formatMoney(n: number) {
  return `${Math.round(n * 100) / 100} с.`
}

async function lookupByPhone(phone: string) {
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, name, phone')
    .eq('phone', phone)
    .maybeSingle()

  if (customerError) {
    throw new Error(customerError.message)
  }

  if (!customer) {
    return null
  }

  const { data: goods, error: goodsError } = await supabase
    .from('goods')
    .select('weight, price, has_paid, created_at')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(30)

  if (goodsError) {
    throw new Error(goodsError.message)
  }

  return { customer, goods: goods ?? [] }
}

function buildLookupMessage(
  customer: { name: string, phone: string },
  goods: Array<{ weight: number, price: number, has_paid: boolean, created_at: string }>,
) {
  const unpaid = goods.filter(g => !g.has_paid)
  const totalRevenue = goods.reduce((s, g) => s + Number(g.price), 0)
  const unpaidRevenue = unpaid.reduce((s, g) => s + Number(g.price), 0)
  const totalWeight = goods.reduce((s, g) => s + Number(g.weight), 0)

  const lines = [
    `👤 ${customer.name}`,
    `📞 +992 ${formatPhone(customer.phone)}`,
    '',
    `Записей: ${goods.length}`,
    `Вес: ${Math.round(totalWeight * 100) / 100} кг`,
    `Сумма: ${formatMoney(totalRevenue)}`,
    `К оплате: ${formatMoney(unpaidRevenue)}`,
    '',
  ]

  if (!goods.length) {
    lines.push('Записей пока нет.')
  }
  else {
    lines.push('История:')
    goods.slice(0, 15).forEach((item, index) => {
      const status = item.has_paid ? '✓' : '•'
      lines.push(
        `${status} ${index + 1}. ${item.weight} кг — ${formatMoney(Number(item.price))}`,
      )
    })
    if (goods.length > 15) {
      lines.push(`…и ещё ${goods.length - 15}`)
    }
  }

  return lines.join('\n')
}

bot.command('start', async (ctx) => {
  const keyboard = new InlineKeyboard()
    .webApp('📦 Для сотрудников', webAppUrl!)
    .row()
    .webApp('🔍 Мой груз', trackUrl)

  await ctx.reply(
    'Добро пожаловать в Aliya Cargo!\n\n'
    + '👷 Сотрудники — откройте приложение для работы.\n'
    + '👤 Клиенты — нажмите «Мой груз» или просто отправьте номер телефона (9 цифр без +992).\n\n'
    + 'Пример: 901123456',
    { reply_markup: keyboard },
  )
})

bot.command('check', async (ctx) => {
  const text = ctx.message?.text || ''
  const raw = text.replace(/^\/check(@\w+)?\s*/i, '').trim()
  const phone = normalizePhone(raw)

  if (!isValidPhone(phone)) {
    await ctx.reply('Использование: /check 901123456\nИли просто отправьте 9 цифр номера.')
    return
  }

  try {
    const result = await lookupByPhone(phone)
    if (!result) {
      await ctx.reply(`По номеру +992 ${formatPhone(phone)} записей не найдено.`)
      return
    }

    await ctx.reply(buildLookupMessage(result.customer, result.goods))
  }
  catch (err) {
    console.error('Lookup error:', err)
    await ctx.reply('Не удалось получить данные. Попробуйте позже.')
  }
})

bot.on('message:text', async (ctx) => {
  const text = ctx.message.text.trim()
  if (text.startsWith('/')) return

  const phone = normalizePhone(text)
  if (!isValidPhone(phone)) {
    await ctx.reply(
      'Отправьте номер телефона без +992 (9 цифр), например: 901123456\n'
      + 'Или откройте «Мой груз» в меню /start.',
    )
    return
  }

  try {
    const result = await lookupByPhone(phone)
    if (!result) {
      await ctx.reply(`По номеру +992 ${formatPhone(phone)} записей не найдено.`)
      return
    }

    await ctx.reply(buildLookupMessage(result.customer, result.goods))
  }
  catch (err) {
    console.error('Lookup error:', err)
    await ctx.reply('Не удалось получить данные. Попробуйте позже.')
  }
})

bot.catch((err) => {
  console.error('Bot error:', err)
})

console.log('Bot starting...')
bot.start()
