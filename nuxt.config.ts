// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      script: [{ src: 'https://telegram.org/js/telegram-web-app.js' }],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
      ],
    },
  },

  vite: {
    server: {
      // Allow ngrok (and similar) tunnel hosts in local dev
      allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.io'],
    },
  },

  runtimeConfig: {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    allowedNicknames: process.env.ALLOWED_NICKNAMES || '',
    supabaseUrl: process.env.SUPABASE_URL || process.env.NUXT_SUPABASE_URL || '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || process.env.NUXT_SUPABASE_SERVICE_KEY || '',
    pricePerKg: Number(process.env.PRICE_PER_KG) || 1000,
    public: {
      appUrl: process.env.NUXT_PUBLIC_APP_URL || '',
    },
  },
})
